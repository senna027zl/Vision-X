const EXT_NAME = "Vision X";

// Estado
let layers = [];
let selectedLayerId = null;
let overlayVisible = false;
let overlayContainer = null;
let dragState = null;

// Persistência
function saveState() {
    if (!extension_settings.visionX) extension_settings.visionX = {};
    extension_settings.visionX.layers = layers.map(l => ({...l, src: l.src && l.src.startsWith('data:') ? l.src : l.src}));
    extension_settings.visionX.overlayVisible = overlayVisible;
    saveSettingsDebounced();
}

function loadState() {
    if (!extension_settings.visionX) extension_settings.visionX = {};
    layers = extension_settings.visionX.layers || [];
    overlayVisible = extension_settings.visionX.overlayVisible || false;
}

// Render no overlay
function renderAllLayers() {
    if (!overlayContainer) return;
    overlayContainer.innerHTML = '';
    layers.forEach(layer => {
        if (!layer.visible) return;
        const el = document.createElement('div');
        el.dataset.layerId = layer.id;
        el.className = 'vx-layer' + (layer.id === selectedLayerId ? ' vx-selected' : '');
        el.style.cssText = `
            position:absolute; left:${layer.x}px; top:${layer.y}px;
            width:${layer.width}px; height:${layer.height}px;
            opacity:${layer.opacity ?? 1};
            mix-blend-mode:${layer.blendMode || 'normal'};
            pointer-events:all; cursor:move; user-select:none;
        `;
        if (layer.type === 'image') {
            const img = document.createElement('img');
            img.src = layer.src;
            img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
            if (layer.gradient?.enabled) {
                const g = layer.gradient;
                el.style.background = `linear-gradient(${g.angle}deg, ${g.color1} 0%, ${g.color2} 100%)`;
                el.style.backgroundBlendMode = 'multiply';
                img.style.cssText += 'position:absolute;top:0;left:0;z-index:-1;';
            }
            el.appendChild(img);
        }
        el.addEventListener('mousedown', onDragStart);
        el.addEventListener('touchstart', onDragStart, {passive: true});
        el.addEventListener('click', e => { e.stopPropagation(); selectLayer(layer.id); });
        overlayContainer.appendChild(el);
    });
}

function selectLayer(id) {
    selectedLayerId = id;
    renderAllLayers();
    refreshSettingsUI();
}

// Drag
function onDragStart(e) {
    const id = parseInt(e.currentTarget.dataset.layerId);
    const layer = layers.find(l => l.id === id);
    if (!layer) return;
    const isTouch = e.type === 'touchstart';
    const startX = isTouch ? e.touches[0].clientX : e.clientX;
    const startY = isTouch ? e.touches[0].clientY : e.clientY;
    const origX = layer.x, origY = layer.y;

    const move = (ev) => {
        const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
        const cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
        layer.x = origX + (cx - startX);
        layer.y = origY + (cy - startY);
        const domEl = overlayContainer.querySelector(`[data-layer-id="${id}"]`);
        if (domEl) { domEl.style.left = layer.x + 'px'; domEl.style.top = layer.y + 'px'; }
    };
    const up = () => {
        saveState();
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        document.removeEventListener('touchmove', move);
        document.removeEventListener('touchend', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    document.addEventListener('touchmove', move, {passive: true});
    document.addEventListener('touchend', up);
    selectLayer(id);
}

// Cria overlay
function buildOverlay() {
    overlayContainer = document.createElement('div');
    overlayContainer.id = 'vx-overlay';
    overlayContainer.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9990;pointer-events:all;overflow:hidden;';
    overlayContainer.style.display = overlayVisible ? 'block' : 'none';
    document.body.appendChild(overlayContainer);
    renderAllLayers();
}

function toggleOverlay() {
    overlayVisible = !overlayVisible;
    overlayContainer.style.display = overlayVisible ? 'block' : 'none';
    saveState();
    refreshSettingsUI();
}

// ============ UI na aba de extensões ============
function refreshSettingsUI() {
    const root = document.getElementById('visionx-settings-root');
    if (!root) return;
    root.innerHTML = `
        <h3>👁 Vision X</h3>
        <button id="vx-toggle-btn" class="menu_button">${overlayVisible ? 'Esconder overlay' : 'Mostrar overlay'}</button>
        <hr>
        <b>Adicionar imagem</b>
        <input type="file" id="vx-file" accept="image/*"><br>
        <input type="text" id="vx-url" placeholder="ou URL da imagem" style="width:100%;"><br>
        <button id="vx-add-btn" class="menu_button">+ Adicionar</button>
        <hr>
        <b>Camadas</b>
        <ul id="vx-layer-list"></ul>
        <div id="vx-properties"></div>
    `;

    document.getElementById('vx-toggle-btn').onclick = toggleOverlay;
    document.getElementById('vx-add-btn').onclick = addImageLayer;

    // Lista camadas
    const list = document.getElementById('vx-layer-list');
    list.innerHTML = layers.length === 0 ? '<li>Nenhuma</li>' : '';
    layers.slice().reverse().forEach(l => {
        const li = document.createElement('li');
        li.textContent = (l.type === 'image' ? '🖼' : '📦') + ' Camada ' + l.id;
        li.style.cursor = 'pointer';
        li.onclick = () => selectLayer(l.id);
        list.appendChild(li);
    });

    // Propriedades da camada selecionada
    const props = document.getElementById('vx-properties');
    if (!selectedLayerId) { props.innerHTML = ''; return; }
    const layer = layers.find(l => l.id === selectedLayerId);
    if (!layer) return;
    props.innerHTML = `
        <b>Propriedades</b>
        <label>Opacidade <input type="range" id="vx-op" min="0" max="1" step="0.01" value="${layer.opacity ?? 1}"></label><br>
        <label>Largura <input type="range" id="vx-w" min="50" max="1200" value="${layer.width}"></label><br>
        <label>Altura <input type="range" id="vx-h" min="50" max="1200" value="${layer.height}"></label><br>
        <label>Blend <select id="vx-blend">${['normal','multiply','screen','overlay','soft-light','hard-light'].map(m => `<option ${layer.blendMode===m?'selected':''}>${m}</option>`).join('')}</select></label><br>
        <button id="vx-remove" class="menu_button">🗑 Remover</button>
    `;
    document.getElementById('vx-op').oninput = function() { layer.opacity = parseFloat(this.value); saveState(); renderAllLayers(); };
    document.getElementById('vx-w').oninput = function() { layer.width = parseInt(this.value); saveState(); renderAllLayers(); };
    document.getElementById('vx-h').oninput = function() { layer.height = parseInt(this.value); saveState(); renderAllLayers(); };
    document.getElementById('vx-blend').onchange = function() { layer.blendMode = this.value; saveState(); renderAllLayers(); };
    document.getElementById('vx-remove').onclick = function() {
        layers = layers.filter(l => l.id !== selectedLayerId);
        selectedLayerId = null;
        saveState();
        renderAllLayers();
        refreshSettingsUI();
    };
}

function addImageLayer() {
    const file = document.getElementById('vx-file').files[0];
    const url = document.getElementById('vx-url').value.trim();
    if (!file && !url) return;
    const create = src => {
        const id = Date.now();
        layers.push({ id, type:'image', src, x:80, y:80, width:180, height:180, opacity:1, blendMode:'normal', visible:true });
        saveState();
        renderAllLayers();
        refreshSettingsUI();
        selectLayer(id);
    };
    if (file) {
        const reader = new FileReader();
        reader.onload = () => create(reader.result);
        reader.readAsDataURL(file);
    } else create(url);
}

// Inicialização
jQuery(async function() {
    loadState();
    buildOverlay();

    // Registrar oficialmente com aba de configurações
    const context = SillyTavern.getContext();
    context.registerExtension(EXT_NAME, {
        type: 'extension',
        getSettingsHtml: () => '<div id="visionx-settings-root"></div>',
        onSettingsShown: () => { refreshSettingsUI(); }
    });
    console.log('[Vision X] Extensão registrada');
});
