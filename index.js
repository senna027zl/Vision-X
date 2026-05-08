/**
 * Vision X — Editor Visual para SillyTavern
 * Baseado em Fabric.js para camadas, drag, resize, blend modes e gradientes
 */

import { extension_settings, saveMetadataDebounced } from '../../../extensions.js';
import { saveSettingsDebounced } from '../../../../script.js';

const EXT_NAME = 'vision-x';
const FABRIC_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js';

let canvas = null;
let panelOpen = false;
let activeTab = 'add';

// ─── Settings ────────────────────────────────────────────────────────────────

function getSettings() {
    if (!extension_settings[EXT_NAME]) {
        extension_settings[EXT_NAME] = { canvasJSON: null };
    }
    return extension_settings[EXT_NAME];
}

function saveCanvas() {
    if (!canvas) return;
    getSettings().canvasJSON = JSON.stringify(canvas.toJSON(['blendMode', 'name', 'lockScalingFlip']));
    saveSettingsDebounced();
}

function loadCanvas() {
    const json = getSettings().canvasJSON;
    if (!canvas || !json) return;
    try {
        canvas.loadFromJSON(json, () => {
            canvas.renderAll();
            updateLayerList();
        });
    } catch(e) {
        console.warn('[Vision X] Erro ao carregar canvas:', e);
    }
}

// ─── Fabric.js loader ─────────────────────────────────────────────────────────

function loadFabric() {
    return new Promise((resolve, reject) => {
        if (window.fabric) return resolve();
        const s = document.createElement('script');
        s.src = FABRIC_CDN;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
    });
}

// ─── Canvas setup ─────────────────────────────────────────────────────────────

function initCanvas() {
    const wrap = document.createElement('div');
    wrap.id = 'vx-canvas-wrap';
    document.body.appendChild(wrap);

    const el = document.createElement('canvas');
    el.id = 'vx-canvas';
    wrap.appendChild(el);

    canvas = new fabric.Canvas('vx-canvas', {
        width: window.innerWidth,
        height: window.innerHeight,
        selection: false,
        renderOnAddRemove: true,
        backgroundColor: null,
        preserveObjectStacking: true,
    });

    // Torna transparente
    canvas.getElement().parentNode.style.background = 'transparent';

    // Resize
    window.addEventListener('resize', () => {
        canvas.setWidth(window.innerWidth);
        canvas.setHeight(window.innerHeight);
        canvas.renderAll();
    });

    // Evento de seleção
    canvas.on('selection:created', updatePropertiesFromSelection);
    canvas.on('selection:updated', updatePropertiesFromSelection);
    canvas.on('selection:cleared', () => {
        document.getElementById('vx-props')?.replaceChildren(noPropMsg());
    });

    // Salva ao mover/redimensionar
    canvas.on('object:modified', () => { saveCanvas(); updateLayerList(); });
    canvas.on('object:added', () => { saveCanvas(); updateLayerList(); });
    canvas.on('object:removed', () => { saveCanvas(); updateLayerList(); });
}

// ─── Painel ───────────────────────────────────────────────────────────────────

function buildPanel() {
    const panel = document.createElement('div');
    panel.id = 'vx-editor';
    panel.innerHTML = `
        <div class="vx-header">
            <span class="vx-header-title">👁 Vision X</span>
            <button id="vx-close">✕</button>
        </div>
        <div class="vx-tabs">
            <button class="vx-tab active" data-tab="add">Adicionar</button>
            <button class="vx-tab" data-tab="layers">Camadas</button>
            <button class="vx-tab" data-tab="props">Propriedades</button>
        </div>
        <div class="vx-scroll">
            <div id="vx-tab-add">${buildAddTab()}</div>
            <div id="vx-tab-layers" style="display:none"></div>
            <div id="vx-tab-props" style="display:none"><div id="vx-props"></div></div>
        </div>
    `;
    document.body.appendChild(panel);

    // Tabs
    panel.querySelectorAll('.vx-tab').forEach(btn => {
        btn.onclick = () => {
            activeTab = btn.dataset.tab;
            panel.querySelectorAll('.vx-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            ['add','layers','props'].forEach(t => {
                document.getElementById(`vx-tab-${t}`).style.display = t === activeTab ? '' : 'none';
            });
            if (activeTab === 'layers') updateLayerList();
        };
    });

    document.getElementById('vx-close').onclick = () => togglePanel(false);

    // Eventos do tab Add
    document.getElementById('vx-add-img-btn').onclick = addImage;
    document.getElementById('vx-add-text-btn').onclick = addText;
    document.getElementById('vx-add-grad-btn').onclick = addGradient;
    document.getElementById('vx-clear-btn').onclick = () => {
        if (confirm('Limpar tudo?')) { canvas.clear(); saveCanvas(); updateLayerList(); }
    };

    updateLayerList();
}

function buildAddTab() {
    return `
        <div class="vx-section">
            <div class="vx-section-title">Imagem</div>
            <label class="vx-label">Da galeria</label>
            <input type="file" id="vx-file" accept="image/*" class="vx-input" style="padding:4px">
            <label class="vx-label">ou URL</label>
            <input type="text" id="vx-url" placeholder="https://..." class="vx-input">
            <button id="vx-add-img-btn" class="vx-btn vx-btn-accent">+ Adicionar imagem</button>
        </div>
        <div class="vx-section">
            <div class="vx-section-title">Texto</div>
            <input type="text" id="vx-text-val" placeholder="Texto aqui..." class="vx-input">
            <div class="vx-row">
                <input type="color" id="vx-text-color" value="#ffffff" class="vx-color">
                <input type="number" id="vx-text-size" value="32" min="8" max="200" class="vx-input" style="width:70px">
            </div>
            <button id="vx-add-text-btn" class="vx-btn">+ Adicionar texto</button>
        </div>
        <div class="vx-section">
            <div class="vx-section-title">Gradiente / Retângulo</div>
            <div class="vx-row">
                <input type="color" id="vx-grad-c1" value="#000000" class="vx-color">
                <input type="color" id="vx-grad-c2" value="#ffffff" class="vx-color">
            </div>
            <div class="vx-row vx-label">
                Ângulo: <span id="vx-grad-ang-val">180°</span>
            </div>
            <input type="range" id="vx-grad-angle" min="0" max="360" value="180" class="vx-range">
            <div class="vx-row vx-label">
                Opacidade: <span id="vx-grad-op-val">80%</span>
            </div>
            <input type="range" id="vx-grad-op" min="0" max="1" step="0.01" value="0.8" class="vx-range">
            <button id="vx-add-grad-btn" class="vx-btn">+ Adicionar gradiente</button>
        </div>
        <div class="vx-section">
            <button id="vx-clear-btn" class="vx-btn vx-btn-danger">🗑 Limpar tudo</button>
        </div>
    `;
}

document.addEventListener('input', (e) => {
    if (e.target.id === 'vx-grad-angle') {
        document.getElementById('vx-grad-ang-val').textContent = e.target.value + '°';
    }
    if (e.target.id === 'vx-grad-op') {
        document.getElementById('vx-grad-op-val').textContent = Math.round(e.target.value * 100) + '%';
    }
});

// ─── Adicionar elementos ──────────────────────────────────────────────────────

function addImage() {
    const file = document.getElementById('vx-file').files[0];
    const url = document.getElementById('vx-url').value.trim();

    const handler = (src) => {
        fabric.Image.fromURL(src, (img) => {
            const maxW = Math.min(300, window.innerWidth * 0.4);
            const scale = maxW / img.width;
            img.set({
                left: 100 + Math.random() * 100,
                top: 100 + Math.random() * 100,
                scaleX: scale,
                scaleY: scale,
                opacity: 1,
                name: 'Imagem',
                crossOrigin: 'anonymous',
            });
            canvas.add(img);
            canvas.setActiveObject(img);
            canvas.renderAll();
        }, { crossOrigin: 'anonymous' });
    };

    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => handler(e.target.result);
        reader.readAsDataURL(file);
    } else if (url) {
        handler(url);
    } else {
        alert('Selecione um arquivo ou cole uma URL');
    }
}

function addText() {
    const val = document.getElementById('vx-text-val').value || 'Texto';
    const color = document.getElementById('vx-text-color').value;
    const size = parseInt(document.getElementById('vx-text-size').value) || 32;

    const text = new fabric.IText(val, {
        left: 100 + Math.random() * 100,
        top: 100 + Math.random() * 100,
        fill: color,
        fontSize: size,
        fontFamily: 'sans-serif',
        opacity: 1,
        name: 'Texto',
    });
    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();
}

function addGradient() {
    const c1 = document.getElementById('vx-grad-c1').value;
    const c2 = document.getElementById('vx-grad-c2').value;
    const angle = parseInt(document.getElementById('vx-grad-angle').value);
    const op = parseFloat(document.getElementById('vx-grad-op').value);

    const rad = (angle * Math.PI) / 180;
    const rect = new fabric.Rect({
        left: 0, top: 0,
        width: window.innerWidth,
        height: window.innerHeight,
        opacity: op,
        name: 'Gradiente',
        fill: new fabric.Gradient({
            type: 'linear',
            gradientUnits: 'percentage',
            coords: {
                x1: 0.5 - Math.cos(rad) * 0.5,
                y1: 0.5 - Math.sin(rad) * 0.5,
                x2: 0.5 + Math.cos(rad) * 0.5,
                y2: 0.5 + Math.sin(rad) * 0.5,
            },
            colorStops: [
                { offset: 0, color: c1 },
                { offset: 1, color: c2 },
            ],
        }),
        selectable: true,
        evented: true,
    });
    canvas.add(rect);
    canvas.setActiveObject(rect);
    canvas.sendToBack(rect);
    canvas.renderAll();
}

// ─── Camadas ──────────────────────────────────────────────────────────────────

function updateLayerList() {
    const container = document.getElementById('vx-tab-layers');
    if (!container) return;
    const objects = canvas ? canvas.getObjects() : [];

    if (objects.length === 0) {
        container.innerHTML = '<div class="vx-section"><div class="vx-no-data">Nenhuma camada ainda</div></div>';
        return;
    }

    container.innerHTML = '';
    const section = document.createElement('div');
    section.className = 'vx-section';
    section.innerHTML = '<div class="vx-section-title">Camadas (arraste no canvas para mover)</div>';

    const ul = document.createElement('ul');
    ul.className = 'vx-list';

    // Mostra em ordem reversa (topo primeiro)
    [...objects].reverse().forEach((obj, i) => {
        const realIdx = objects.length - 1 - i;
        const li = document.createElement('li');
        li.className = 'vx-list-item' + (canvas.getActiveObject() === obj ? ' selected' : '');
        const name = obj.name || obj.type || 'objeto';
        li.innerHTML = `
            <span>${getLayerIcon(obj)} ${name}</span>
            <div style="display:flex;gap:4px;align-items:center">
                <button class="vx-eye-btn" title="Visibilidade">👁</button>
                <button class="vx-eye-btn vx-del" title="Remover">✕</button>
            </div>
        `;
        li.onclick = () => { canvas.setActiveObject(obj); canvas.renderAll(); selectTab('props'); updatePropertiesFromSelection(); };
        li.querySelector('.vx-eye-btn').onclick = (e) => {
            e.stopPropagation();
            obj.visible = !obj.visible;
            canvas.renderAll();
            saveCanvas();
            updateLayerList();
        };
        li.querySelector('.vx-del').onclick = (e) => {
            e.stopPropagation();
            canvas.remove(obj);
            canvas.renderAll();
        };
        ul.appendChild(li);
    });

    section.appendChild(ul);
    container.appendChild(section);
}

function getLayerIcon(obj) {
    if (obj.type === 'image') return '🖼';
    if (obj.type === 'i-text' || obj.type === 'text') return '✍';
    if (obj.type === 'rect') return '◻';
    return '📦';
}

function selectTab(tab) {
    activeTab = tab;
    document.querySelectorAll('.vx-tab').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === tab);
    });
    ['add','layers','props'].forEach(t => {
        const el = document.getElementById(`vx-tab-${t}`);
        if (el) el.style.display = t === tab ? '' : 'none';
    });
}

// ─── Propriedades ─────────────────────────────────────────────────────────────

function noPropMsg() {
    const d = document.createElement('div');
    d.className = 'vx-no-data';
    d.textContent = 'Selecione um elemento no canvas para editar';
    return d;
}

function updatePropertiesFromSelection() {
    const propsEl = document.getElementById('vx-props');
    if (!propsEl) return;
    const obj = canvas?.getActiveObject();
    if (!obj) { propsEl.innerHTML = ''; propsEl.appendChild(noPropMsg()); return; }

    if (activeTab !== 'props') selectTab('props');

    propsEl.innerHTML = '';

    // Opacidade
    const opSection = mkSection('Opacidade & Blend');
    opSection.appendChild(mkRow('Opacidade', 'range', {
        min: 0, max: 1, step: 0.01, value: obj.opacity,
        onChange: (v) => { obj.set('opacity', parseFloat(v)); canvas.renderAll(); saveCanvas(); },
        display: (v) => Math.round(v * 100) + '%',
    }));

    const blendSel = document.createElement('select');
    blendSel.className = 'vx-input';
    ['', 'multiply','screen','overlay','soft-light','hard-light','color-dodge','color-burn','darken','lighten','difference','exclusion'].forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m || 'normal';
        if ((obj.globalCompositeOperation || '') === m) opt.selected = true;
        blendSel.appendChild(opt);
    });
    blendSel.onchange = () => {
        obj.set('globalCompositeOperation', blendSel.value);
        canvas.renderAll();
        saveCanvas();
    };
    const blendLabel = document.createElement('div');
    blendLabel.className = 'vx-label';
    blendLabel.textContent = 'Blend Mode';
    opSection.appendChild(blendLabel);
    opSection.appendChild(blendSel);
    propsEl.appendChild(opSection);

    // Posição e tamanho
    const posSection = mkSection('Posição & Tamanho');
    posSection.appendChild(mkRow('X', 'number', {
        value: Math.round(obj.left),
        onChange: (v) => { obj.set('left', parseInt(v)); canvas.renderAll(); saveCanvas(); }
    }));
    posSection.appendChild(mkRow('Y', 'number', {
        value: Math.round(obj.top),
        onChange: (v) => { obj.set('top', parseInt(v)); canvas.renderAll(); saveCanvas(); }
    }));
    posSection.appendChild(mkRow('Escala X', 'range', {
        min: 0.05, max: 5, step: 0.01, value: obj.scaleX || 1,
        onChange: (v) => { obj.set('scaleX', parseFloat(v)); canvas.renderAll(); saveCanvas(); },
        display: (v) => parseFloat(v).toFixed(2) + 'x',
    }));
    posSection.appendChild(mkRow('Escala Y', 'range', {
        min: 0.05, max: 5, step: 0.01, value: obj.scaleY || 1,
        onChange: (v) => { obj.set('scaleY', parseFloat(v)); canvas.renderAll(); saveCanvas(); },
        display: (v) => parseFloat(v).toFixed(2) + 'x',
    }));
    posSection.appendChild(mkRow('Rotação', 'range', {
        min: -180, max: 180, step: 1, value: obj.angle || 0,
        onChange: (v) => { obj.set('angle', parseInt(v)); canvas.renderAll(); saveCanvas(); },
        display: (v) => v + '°',
    }));
    propsEl.appendChild(posSection);

    // Texto específico
    if (obj.type === 'i-text' || obj.type === 'text') {
        const textSection = mkSection('Texto');
        const sizeRow = mkRow('Tamanho', 'range', {
            min: 8, max: 200, step: 1, value: obj.fontSize,
            onChange: (v) => { obj.set('fontSize', parseInt(v)); canvas.renderAll(); saveCanvas(); },
            display: (v) => v + 'px',
        });
        textSection.appendChild(sizeRow);

        const colorLabel = document.createElement('div');
        colorLabel.className = 'vx-label';
        colorLabel.textContent = 'Cor';
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.className = 'vx-color';
        colorInput.value = obj.fill || '#ffffff';
        colorInput.oninput = () => { obj.set('fill', colorInput.value); canvas.renderAll(); saveCanvas(); };
        textSection.appendChild(colorLabel);
        textSection.appendChild(colorInput);
        propsEl.appendChild(textSection);
    }

    // Remover
    const delSection = mkSection('');
    const delBtn = document.createElement('button');
    delBtn.className = 'vx-btn vx-btn-danger';
    delBtn.textContent = '🗑 Remover elemento';
    delBtn.onclick = () => { canvas.remove(obj); canvas.renderAll(); propsEl.innerHTML = ''; propsEl.appendChild(noPropMsg()); };
    delSection.appendChild(delBtn);
    propsEl.appendChild(delSection);
}

function mkSection(title) {
    const div = document.createElement('div');
    div.className = 'vx-section';
    if (title) {
        const t = document.createElement('div');
        t.className = 'vx-section-title';
        t.textContent = title;
        div.appendChild(t);
    }
    return div;
}

function mkRow(label, type, opts) {
    const wrap = document.createElement('div');
    const lbl = document.createElement('div');
    lbl.className = 'vx-label';

    const valSpan = document.createElement('span');
    valSpan.className = 'vx-val';
    if (opts.display) valSpan.textContent = opts.display(opts.value);

    lbl.textContent = label + ' ';
    lbl.appendChild(valSpan);
    wrap.appendChild(lbl);

    const input = document.createElement('input');
    input.type = type;
    if (type === 'range' || type === 'number') {
        input.min = opts.min;
        input.max = opts.max;
        input.step = opts.step || 1;
    }
    input.value = opts.value;
    input.className = type === 'range' ? 'vx-range' : 'vx-input';
    input.style.width = '100%';

    input.addEventListener('input', () => {
        if (opts.display) valSpan.textContent = opts.display(input.value);
        opts.onChange(input.value);
    });
    wrap.appendChild(input);
    return wrap;
}

// ─── Botão flutuante ──────────────────────────────────────────────────────────

function buildFab() {
    const btn = document.createElement('button');
    btn.id = 'vx-fab';
    btn.textContent = '👁';
    btn.title = 'Vision X';
    btn.onclick = () => togglePanel(!panelOpen);
    document.body.appendChild(btn);
}

function togglePanel(show) {
    panelOpen = show;
    const panel = document.getElementById('vx-editor');
    const wrap = document.getElementById('vx-canvas-wrap');
    const fab = document.getElementById('vx-fab');
    if (panel) panel.classList.toggle('open', show);
    if (wrap) wrap.classList.toggle('editing', show);
    if (fab) fab.classList.toggle('active', show);
    if (show && canvas) {
        canvas.selection = true;
        canvas.getObjects().forEach(o => o.set({ selectable: true, evented: true }));
    } else if (canvas) {
        canvas.discardActiveObject();
        canvas.selection = false;
        canvas.getObjects().forEach(o => o.set({ selectable: false, evented: false }));
        canvas.renderAll();
    }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

jQuery(async () => {
    try {
        await loadFabric();
        initCanvas();
        buildFab();
        buildPanel();
        loadCanvas();
        togglePanel(false)
