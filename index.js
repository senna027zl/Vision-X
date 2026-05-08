const EXT_NAME = 'vision-x';
let layers = [];
let selectedLayerId = null;
let overlayContainer = null;
let overlayVisible = false;
let dragState = null;

// ============ PERSISTÊNCIA ============
function saveState() {
    if (!extension_settings[EXT_NAME]) extension_settings[EXT_NAME] = {};
    extension_settings[EXT_NAME].layers = layers.map(l => ({
        ...l,
        src: l.src && l.src.startsWith('data:') ? l.src : l.src
    }));
    extension_settings[EXT_NAME].overlayVisible = overlayVisible;
    saveSettingsDebounced();
}

function loadState() {
    if (!extension_settings[EXT_NAME]) extension_settings[EXT_NAME] = {};
    layers = extension_settings[EXT_NAME].layers || [];
    overlayVisible = extension_settings[EXT_NAME].overlayVisible || false;
}

// ============ RENDER OVERLAY (camadas sobre o chat) ============
function renderAllLayers() {
    if (!overlayContainer) return;
    overlayContainer.innerHTML = '';

    layers.forEach(layer => {
        if (!layer.visible) return;

        const el = document.createElement('div');
        el.className = 'vx-layer';
        if (layer.id === selectedLayerId) el.classList.add('vx-selected');
        el.dataset.layerId = layer.id;
        el.style.cssText = `
            position: absolute;
            left: ${layer.x}px;
            top: ${layer.y}px;
            width: ${layer.width}px;
            height: ${layer.height}px;
            opacity: ${layer.opacity ?? 1};
            mix-blend-mode: ${layer.blendMode || 'normal'};
            pointer-events: all;
            cursor: move;
            user-select: none;
        `;

        if (layer.type === 'image') {
            const img = document.createElement('img');
            img.src = layer.src;
            img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
            if (layer.gradient && layer.gradient.enabled) {
                const g = layer.gradient;
                el.style.background = `linear-gradient(${g.angle}deg, ${g.color1} 0%, ${g.color2} 100%)`;
                el.style.backgroundBlendMode = 'multiply';
                img.style.position = 'absolute';
                img.style.top = '0';
                img.style.left = '0';
                img.style.zIndex = '-1';
            }
            el.appendChild(img);
        }

        el.addEventListener('mousedown', onDragStart);
        el.addEventListener('touchstart', onDragStart, { passive: true });
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            selectLayer(layer.id);
        });
        overlayContainer.appendChild(el);
    });
}

function selectLayer(id) {
    selectedLayerId = id;
    renderAllLayers();
    updatePropertiesPanelInExtension();
}

// ============ DRAG ============
function onDragStart(e) {
    const el = e.currentTarget;
    const id = parseInt(el.dataset.layerId);
    const layer = layers.find(l => l.id === id);
    if (!layer) return;

    const isTouch = e.type === 'touchstart';
    const startX = isTouch ? e.touches[0].clientX : e.clientX;
    const startY = isTouch ? e.touches[0].clientY : e.clientY;
    const origX = layer.x;
    const origY = layer.y;
    dragState = { id, startX, startY, origX, origY };

    const onMove = (ev) => {
        const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
        const cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
        layer.x = origX + (cx - startX);
        layer.y = origY + (cy - startY);
        const domEl = overlayContainer.querySelector(`[data-layer-id="${id}"]`);
        if (domEl) {
            domEl.style.left = layer.x + 'px';
            domEl.style.top = layer.y + 'px';
        }
    };

    const onUp = () => {
        saveState();
        dragState = null;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend', onUp);
    selectLayer(id);
}

// ============ INTERFACE NA ABA DE EXTENSÕES ============
let extensionTabHtml = '';

function buildExtensionUI() {
    extensionTabHtml = `
        <div id="visionx-ext-ui" style="padding:10px;color:#cdd6f4;">
            <h3>👁 Vision X</h3>
            <button id="vx-toggle-overlay" class="btn btn-primary">${overlayVisible ? 'Esconder Overlay' : 'Mostrar Overlay'}</button>
            <hr style="border-color:#45475a">
            <div class="vx-section">
                <div class="vx-section-title">Adicionar Imagem</div>
                <input type="file" id="vx-file" accept="image/*" style="width:100%">
                <input type="text" id="vx-url" placeholder="ou cole URL..." class="vx-input" style="width:100%;margin-top:5px;">
                <button id="vx-add-img" class="vx-btn vx-btn-accent">+ Adicionar</button>
            </div>
            <div class="vx-section">
                <div class="vx-section-title">Camadas</div>
                <ul id="vx-layer-list" class="vx-list"></ul>
            </div>
            <div id="vx-properties"></div>
        </div>
    `;
}

function injectExtensionUI() {
    // SillyTavern expõe um container para cada extensão via jQuery. Procuraremos o containe certo.
    const container = document.querySelector('#extensions_settings .extension_container.vision-x, #vision-x-settings');
    if (!container) {
        setTimeout(injectExtensionUI, 500);
        return;
    }
    if (document.getElementById('visionx-ext-ui')) return; // já injetado
    container.innerHTML = ''; // limpa
    const div = document.createElement('div');
    div.innerHTML = extensionTabHtml;
    container.appendChild(div);

    // Eventos
    document.getElementById('vx-toggle-overlay').onclick = () => {
        overlayVisible = !overlayVisible;
        saveState();
        updateOverlayVisibility();
        document.getElementById('vx-toggle-overlay').textContent = overlayVisible ? 'Esconder Overlay' : 'Mostrar Overlay';
    };

    document.getElementById('vx-add-img').onclick = addImageLayer;

    updateLayerListInExtension();
    updatePropertiesPanelInExtension();
}

function updateLayerListInExtension() {
    const list = document.getElementById('vx-layer-list');
    if (!list) return;
    list.innerHTML = '';
    if (layers.length === 0) {
        list.innerHTML = '<li style="color:#555;font-size:11px">Nenhuma camada ainda</li>';
        return;
    }
    layers.slice().reverse().forEach(layer => {
        const li = document.createElement('li');
        li.className = 'vx-list-item' + (layer.id === selectedLayerId ? ' vx-list-selected' : '');
        li.innerHTML = `
            <span>${layer.type === 'image' ? '🖼' : '📦'} Camada ${layer.id}</span>
            <button class="vx-eye" data-id="${layer.id}">${layer.visible ? '👁' : '🚫'}</button>
        `;
        li.onclick = () => selectLayer(layer.id);
        li.querySelector('.vx-eye').onclick = (e) => {
            e.stopPropagation();
            const l = layers.find(x => x.id === parseInt(e.target.dataset.id));
            if (l) { l.visible = !l.visible; saveState(); renderAllLayers(); updateLayerListInExtension(); }
        };
        list.appendChild(li);
    });
}

function updatePropertiesPanelInExtension() {
    const panel = document.getElementById('vx-properties');
    if (!panel) return;
    if (!selectedLayerId) { panel.innerHTML = ''; return; }
    const layer = layers.find(l => l.id === selectedLayerId);
    if (!layer) return;

    panel.innerHTML = `
        <div class="vx-section">
            <div class="vx-section-title">Propriedades</div>
            <label>Opacidade: <span id="vx-op-val">${Math.round((layer.opacity ?? 1)*100)}%</span></label>
            <input type="range" id="vx-opacity" min="0" max="1" step="0.01" value="${layer.opacity ?? 1}" class="vx-range">
            <label>Largura: <span id="vx-w-val">${layer.width}px</span></label>
            <input type="range" id="vx-width" min="50" max="1200" value="${layer.width}" class="vx-range">
            <label>Altura: <span id="vx-h-val">${layer.height}px</span></label>
            <input type="range" id="vx-height" min="50" max="1200" value="${layer.height}" class="vx-range">
            <label>Blend Mode</label>
            <select id="vx-blend" class="vx-input">
                ${['normal','multiply','screen','overlay','soft-light','hard-light','color-dodge','color-burn','darken','lighten','difference','exclusion'].map(m => `<option ${layer.blendMode===m?'selected':''}>${m}</option>`).join('')}
            </select>
            <div class="vx-section-title" style="margin-top:12px">Degradê sobre imagem</div>
            <label><input type="checkbox" id="vx-grad-on" ${layer.gradient?.enabled?'checked':''}> Ativar degradê</label>
            <label>Cor 1</label><input type="color" id="vx-grad-c1" value="${layer.gradient?.color1||'#000000'}" class="vx-color">
            <label>Cor 2</label><input type="color" id="vx-grad-c2" value="${layer.gradient?.color2||'#ffffff'}" class="vx-color">
            <label>Ângulo: <span id="vx-ang-val">${layer.gradient?.angle||180}°</span></label>
            <input type="range" id="vx-grad-angle" min="0" max="360" value="${layer.gradient?.angle||180}" class="vx-range">
            <button id="vx-remove" class="vx-btn vx-btn-danger" style="margin-top:12px">🗑 Remover camada</button>
        </div>
    `;

    const bind = (id, prop, transform) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('input', () => {
            const val = transform ? transform(el.value) : el.value;
            if (prop.includes('.')) {
                const [a, b] = prop.split('.');
                if (!layer[a]) layer[a] = {};
                layer[a][b] = val;
            } else {
                layer[prop] = val;
            }
            if (id === 'vx-opacity') document.getElementById('vx-op-val').textContent = Math.round(val*100)+'%';
            if (id === 'vx-width') document.getElementById('vx-w-val').textContent = val+'px';
            if (id === 'vx-height') document.getElementById('vx-h-val').textContent = val+'px';
            if (id === 'vx-grad-angle') document.getElementById('vx-ang-val').textContent = val+'°';
            saveState();
            renderAllLayers();
        });
    };

    bind('vx-opacity', 'opacity', parseFloat);
    bind('vx-width', 'width', parseInt);
    bind('vx-height', 'height', parseInt);
    bind('vx-blend', 'blendMode', null);
    bind('vx-grad-on', 'gradient.enabled', () => document.getElementById('vx-grad-on').checked);
    bind('vx-grad-c1', 'gradient.color1', null);
    bind('vx-grad-c2', 'gradient.color2', null);
    bind('vx-grad-angle', 'gradient.angle', parseInt);

    document.getElementById('vx-remove').onclick = () => {
        layers = layers.filter(l => l.id !== selectedLayerId);
        selectedLayerId = null;
        saveState();
        renderAllLayers();
        updateLayerListInExtension();
        updatePropertiesPanelInExtension();
    };
}

function addImageLayer() {
    const file = document.getElementById('vx-file').files[0];
    const url = document.getElementById('vx-url').value.trim();
    if (!file && !url) { alert('Selecione um arquivo ou cole uma URL'); return; }

    const create = (src) => {
        const id = Date.now();
        layers.push({
            id, type: 'image', src,
            x: 50 + Math.random()*100,
            y: 80 + Math.random()*100,
            width: 180, height: 180,
            opacity: 1, blendMode: 'normal',
            visible: true,
            gradient: { enabled: false, color1: '#000000', color2: '#ffffff', angle: 180 }
        });
        saveState();
        renderAllLayers();
        updateLayerListInExtension();
        selectLayer(id);
    };

    if (file) {
        const reader = new FileReader();
        reader.onload = () => create(reader.result);
        reader.readAsDataURL(file);
    } else {
        create(url);
    }
}

// ============ OVERLAY CONTAINER ============
function buildOverlay() {
    overlayContainer = document.createElement('div');
    overlayContainer.id = 'vx-overlay';
    overlayContainer.style.cssText = `
        position: fixed; top: 0; left: 0;
        width: 100vw; height: 100vh;
        z-index: 9990; pointer-events: all; overflow: hidden;
        display: ${overlayVisible ? 'block' : 'none'};
    `;
    document.body.appendChild(overlayContainer);
}

function updateOverlayVisibility() {
    if (overlayContainer) overlayContainer.style.display = overlayVisible ? 'block' : 'none';
}

// ============ INIT ============
function initVisionX() {
    loadState();
    buildOverlay();
    renderAllLayers();
    buildExtensionUI();
    setTimeout(injectExtensionUI, 1000); // aguarda ST montar a aba
    console.log('[Vision X] Carregado (extensão integrada) ✓');
}

if (document.body) {
    initVisionX();
} else {
    document.addEventListener('DOMContentLoaded', initVisionX);
}
