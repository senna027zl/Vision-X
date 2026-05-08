// Vision X Studio v2.0 — Completo
(function() {
    if (document.getElementById('visionx-studio-loaded')) return;
    const marker = document.createElement('script');
    marker.id = 'visionx-studio-loaded';
    document.head.appendChild(marker);

    const LS_KEY = 'visionx_studio_state';
    let state = {
        background: { type: 'color', value: '#121212' },
        layers: [],
        animations: { particles: false, rain: false },
        messages: { bubbleColor: '#313244', textColor: '#cdd6f4', borderRadius: 12 }
    };
    let selectedLayerId = null;
    let overlayContainer = null;
    let panel = null;
    let panelOpen = false;

    function saveState() { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch(e) {} }
    function loadState() { try { const s = localStorage.getItem(LS_KEY); if (s) Object.assign(state, JSON.parse(s)); } catch(e) {} }

    function applyBackground() {
        document.body.style.backgroundImage = '';
        document.body.style.backgroundColor = '';
        if (state.background.type === 'image' && state.background.value) {
            document.body.style.backgroundImage = `url(${state.background.value})`;
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundPosition = 'center';
        } else if (state.background.type === 'gradient' && state.background.value) {
            document.body.style.backgroundImage = state.background.value;
        } else {
            document.body.style.backgroundColor = state.background.value;
        }
    }

    function applyMessageStyle() {
        const old = document.getElementById('vx-msg-style');
        if (old) old.remove();
        const style = document.createElement('style');
        style.id = 'vx-msg-style';
        style.textContent = `.mes { background-color: ${state.messages.bubbleColor} !important; color: ${state.messages.textColor} !important; border-radius: ${state.messages.borderRadius}px !important; }`;
        document.head.appendChild(style);
    }

    function buildOverlay() {
        overlayContainer = document.createElement('div');
        overlayContainer.id = 'vx-overlay';
        overlayContainer.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9990;pointer-events:none;';
        document.body.appendChild(overlayContainer);
        renderAllLayers();
    }

    function renderAllLayers() {
        if (!overlayContainer) return;
        overlayContainer.innerHTML = '';
        state.layers.forEach(layer => {
            if (!layer.visible) return;
            const el = document.createElement('div');
            el.dataset.layerId = layer.id;
            el.style.cssText = `position:absolute;left:${layer.x}px;top:${layer.y}px;width:${layer.width}px;height:${layer.height}px;opacity:${layer.opacity};mix-blend-mode:${layer.blendMode};filter:blur(${layer.blur||0}px) brightness(${layer.brightness||1}) contrast(${layer.contrast||1});transform:rotate(${layer.rotation||0}deg);pointer-events:all;cursor:move;user-select:none;`;
            if (layer.type === 'image') {
                const img = document.createElement('img');
                img.src = layer.src; img.draggable = false;
                img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
                el.appendChild(img);
            }
            el.addEventListener('mousedown', onDragStart);
            el.addEventListener('touchstart', onDragStart, {passive: true});
            overlayContainer.appendChild(el);
        });
    }

    function onDragStart(e) {
        const id = parseInt(e.currentTarget.dataset.layerId);
        const layer = state.layers.find(l => l.id === id);
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
        document.addEventListener('touchmove', move, {passive: false});
        document.addEventListener('touchend', up);
        selectLayer(id);
    }

    function selectLayer(id) {
        selectedLayerId = id;
        renderAllLayers();
        if (panelOpen) buildPanelContent();
    }

    function buildPanel() {
        panel = document.createElement('div');
        panel.id = 'vx-studio-panel';
        panel.style.cssText = 'position:fixed;top:0;right:0;width:360px;height:100vh;background:#181825;color:#cdd6f4;padding:0;overflow-y:auto;z-index:99999;transform:translateX(100%);transition:transform 0.3s;font-family:system-ui;box-shadow:-4px 0 20px rgba(0,0,0,0.5);';
        document.body.appendChild(panel);
    }

    function togglePanel(show) {
        panelOpen = show;
        panel.style.transform = show ? 'translateX(0)' : 'translateX(100%)';
        if (show) buildPanelContent();
    }

    let currentTab = 'background';
    function buildPanelContent() {
        panel.innerHTML = `
            <div style="display:flex;justify-content:space-between;padding:12px;background:#11111b;">
                <b>🎨 Vision X Studio</b>
                <button id="vx-close-btn" style="background:none;border:none;color:#f5c2e7;font-size:18px;">✕</button>
            </div>
            <div style="display:flex;gap:4px;padding:8px;background:#1e1e2e;">
                <button class="vx-tab" data-tab="background">Fundo</button>
                <button class="vx-tab" data-tab="layers">Camadas</button>
                <button class="vx-tab" data-tab="animations">Animações</button>
                <button class="vx-tab" data-tab="messages">Mensagens</button>
            </div>
            <div id="vx-tab-content" style="padding:12px;"></div>
        `;
        document.getElementById('vx-close-btn').onclick = () => togglePanel(false);
        document.querySelectorAll('.vx-tab').forEach(btn => {
            btn.onclick = () => { currentTab = btn.dataset.tab; buildPanelContent(); };
        });
        const content = document.getElementById('vx-tab-content');
        if (currentTab === 'background') buildBackgroundTab(content);
        else if (currentTab === 'layers') buildLayersTab(content);
        else if (currentTab === 'animations') buildAnimationsTab(content);
        else if (currentTab === 'messages') buildMessagesTab(content);
    }

    function buildBackgroundTab(container) {
        container.innerHTML = `<h4>Fundo do Chat</h4>
            <select id="bg-type"><option value="color" ${state.background.type==='color'?'selected':''}>Cor sólida</option><option value="image" ${state.background.type==='image'?'selected':''}>Imagem</option><option value="gradient" ${state.background.type==='gradient'?'selected':''}>Gradiente</option></select>
            <div id="bg-color-picker"><label>Cor:</label><input type="color" id="bg-color" value="${state.background.type==='color'?state.background.value:'#121212'}"></div>
            <div id="bg-image-upload"><input type="file" id="bg-file" accept="image/*"><button id="bg-upload-btn">Enviar</button></div>
            <div id="bg-gradient"><label>Gradiente CSS:</label><input type="text" id="bg-gradient-val" placeholder="linear-gradient(45deg, #000, #fff)" value="${state.background.type==='gradient'?state.background.value:''}"></div>`;
        document.getElementById('bg-type').onchange = function() {
            state.background.type = this.value; saveState(); applyBackground(); buildPanelContent();
        };
        document.getElementById('bg-color').oninput = function() {
            state.background.value = this.value; saveState(); applyBackground();
        };
        document.getElementById('bg-upload-btn').onclick = function() {
            const file = document.getElementById('bg-file').files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => { state.background.value = reader.result; saveState(); applyBackground(); };
            reader.readAsDataURL(file);
        };
        document.getElementById('bg-gradient-val').oninput = function() {
            state.background.value = this.value; saveState(); applyBackground();
        };
    }

    function buildLayersTab(container) {
        container.innerHTML = `<h4>Camadas</h4><button id="add-layer-btn">+ Adicionar Imagem</button><input type="file" id="layer-file" accept="image/*" style="display:none"><input type="text" id="layer-url" placeholder="URL da imagem" style="width:100%; margin-top:8px;"><ul id="layers-list" style="margin-top:8px;"></ul><div id="layer-props"></div>`;
        document.getElementById('add-layer-btn').onclick = () => document.getElementById('layer-file').click();
        document.getElementById('layer-file').onchange = function() {
            const file = this.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                state.layers.push({ id: Date.now(), type:'image', src: reader.result, x:100, y:100, width:200, height:200, opacity:1, blendMode:'normal', blur:0, brightness:1, contrast:1, rotation:0, visible:true });
                saveState(); renderAllLayers(); buildPanelContent();
            };
            reader.readAsDataURL(file);
        };
        document.getElementById('layer-url').onchange = function() {
            const url = this.value.trim();
            if (!url) return;
            state.layers.push({ id: Date.now(), type:'image', src: url, x:100, y:100, width:200, height:200, opacity:1, blendMode:'normal', blur:0, brightness:1, contrast:1, rotation:0, visible:true });
            saveState(); renderAllLayers(); buildPanelContent();
        };
        updateLayersList();
    }

    function updateLayersList() {
        const list = document.getElementById('layers-list');
        if (!list) return;
        list.innerHTML = state.layers.length === 0 ? '<p>Nenhuma camada</p>' : '';
        state.layers.forEach((layer, idx) => {
            const item = document.createElement('div');
            item.style.cssText = 'padding:4px;cursor:pointer;display:flex;justify-content:space-between;';
            if (layer.id === selectedLayerId) item.style.background = '#45475a';
            item.innerHTML = `<span>🖼 Camada ${idx+1}</span><button class="vis-toggle" data-id="${layer.id}">${layer.visible?'👁':'🚫'}</button>`;
            item.onclick = () => selectLayer(layer.id);
            item.querySelector('.vis-toggle').onclick = (e) => {
                e.stopPropagation();
                layer.visible = !layer.visible;
                saveState(); renderAllLayers(); updateLayersList();
            };
            list.appendChild(item);
        });
    }

    function buildAnimationsTab(container) {
        container.innerHTML = `<h4>Animações</h4>
            <label><input type="checkbox" id="anim-particles" ${state.animations.particles?'checked':''}> Partículas</label><br>
            <label><input type="checkbox" id="anim-rain" ${state.animations.rain?'checked':''}> Chuva</label>`;
        document.getElementById('anim-particles').onchange = e => { state.animations.particles = e.target.checked; saveState(); toggleAnimations(); };
        document.getElementById('anim-rain').onchange = e => { state.animations.rain = e.target.checked; saveState(); toggleAnimations(); };
    }

    function toggleAnimations() {
        let style = document.getElementById('vx-anim-style');
        if (!style) { style = document.createElement('style'); style.id = 'vx-anim-style'; document.head.appendChild(style); }
        let css = '';
        if (state.animations.particles) {
            css += `body::before { content:''; position:fixed; top:0; left:0; width:100%; height:100%; background:radial-gradient(circle at 30% 50%, rgba(255,255,255,0.2) 1px, transparent 1px); background-size:20px 20px; animation:float 20s linear infinite; pointer-events:none; z-index:9999; } @keyframes float { 0% { transform: translateY(0); } 100% { transform: translateY(-100%); } }`;
        }
        if (state.animations.rain) {
            css += `body::after { content:''; position:fixed; top:-10px; left:0; width:2px; height:100px; background:linear-gradient(transparent, rgba(255,255,255,0.3)); animation:rain 0.5s linear infinite; pointer-events:none; z-index:9999; } @keyframes rain { 0% { transform: translateY(-100px); } 100% { transform: translateY(100vh); } }`;
        }
        style.textContent = css;
    }

    function buildMessagesTab(container) {
        container.innerHTML = `<h4>Estilo das Mensagens</h4>
            <label>Cor bolha:</label><input type="color" id="msg-bubble" value="${state.messages.bubbleColor}">
            <label>Cor texto:</label><input type="color" id="msg-text" value="${state.messages.textColor}">
            <label>Borda:</label><input type="range" id="msg-radius" min="0" max="30" value="${state.messages.borderRadius}">`;
        document.getElementById('msg-bubble').oninput = e => { state.messages.bubbleColor = e.target.value; saveState(); applyMessageStyle(); };
        document.getElementById('msg-text').oninput = e => { state.messages.textColor = e.target.value; saveState(); applyMessageStyle(); };
        document.getElementById('msg-radius').oninput = e => { state.messages.borderRadius = parseInt(e.target.value); saveState(); applyMessageStyle(); };
    }

    function createButton() {
        const btn = document.createElement('button');
        btn.textContent = '🎨';
        btn.style.cssText = 'position:fixed;top:10px;right:16px;z-index:99998;width:48px;height:48px;border-radius:50%;background:#cba6f7;color:#1e1e2e;border:none;font-size:24px;box-shadow:0 4px 12px rgba(0,0,0,0.4);cursor:pointer;';
        btn.onclick = () => togglePanel(!panelOpen);
        document.body.appendChild(btn);
    }

    function init() {
        loadState();
        applyBackground();
        applyMessageStyle();
        buildOverlay();
        buildPanel();
        createButton();
        toggleAnimations();
    }

    if (document.body) init();
    else document.addEventListener('DOMContentLoaded', init);
})();

