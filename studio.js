// Vision X Studio v3.0 — Editor Visual Completo
(function() {
    if (document.getElementById('vx-editor-loaded')) return;
    const marker = document.createElement('script');
    marker.id = 'vx-editor-loaded';
    document.head.appendChild(marker);

    // Estado
    let editorEnabled = false;
    let selectedElement = null;
    let panel = null;
    let floatingBtn = null;

    // Estilos salvos
    const STYLE_KEY = 'vx_custom_styles';
    let customStyles = {};

    function loadStyles() {
        try {
            const saved = localStorage.getItem(STYLE_KEY);
            if (saved) customStyles = JSON.parse(saved);
        } catch(e) {}
    }

    function saveStyles() {
        try {
            localStorage.setItem(STYLE_KEY, JSON.stringify(customStyles));
        } catch(e) {}
    }

    function applyAllStyles() {
        const styleEl = document.getElementById('vx-custom-style');
        if (styleEl) styleEl.remove();
        const style = document.createElement('style');
        style.id = 'vx-custom-style';
        let css = '';
        Object.keys(customStyles).forEach(selector => {
            const props = customStyles[selector];
            css += `${selector} { ${Object.entries(props).map(([k,v]) => `${k}:${v}`).join(';')} } `;
        });
        style.textContent = css;
        document.head.appendChild(style);
    }

    // Painel de edição
    function createPanel() {
        panel = document.createElement('div');
        panel.id = 'vx-editor-panel';
        panel.style.cssText = `
            position:fixed; top:0; right:0; width:320px; height:100vh;
            background:#181825; color:#cdd6f4; padding:12px; overflow-y:auto;
            z-index:99999; transform:translateX(100%); transition:transform 0.3s;
            font-family:system-ui; box-shadow:-4px 0 20px rgba(0,0,0,0.5);
        `;
        document.body.appendChild(panel);
    }

    function togglePanel(show) {
        if (show) {
            panel.style.transform = 'translateX(0)';
            enableSelectionMode();
        } else {
            panel.style.transform = 'translateX(100%)';
            disableSelectionMode();
        }
        buildPanelContent();
    }

    function buildPanelContent() {
        if (!selectedElement) {
            panel.innerHTML = `
                <h3>🛠️ Editor Visual</h3>
                <p style="color:#a6adc8;font-size:13px;">Toque em qualquer elemento da página para editar.</p>
                <button id="vx-close-panel" style="background:#f38ba8; color:#1e1e2e; border:none; padding:8px; border-radius:6px; width:100%;">Fechar Editor</button>
            `;
            document.getElementById('vx-close-panel').onclick = () => togglePanel(false);
            return;
        }

        const el = selectedElement;
        const computed = window.getComputedStyle(el);
        const selector = getUniqueSelector(el);

        panel.innerHTML = `
            <h3>🎯 Editando: <code style="font-size:11px; color:#cba6f7;">${el.tagName.toLowerCase()}${el.id?'#'+el.id:''}${el.className?'.'+el.className.split(' ').join('.'):''}</code></h3>
            <button id="vx-done-btn" style="background:#a6e3a1; color:#1e1e2e; border:none; padding:8px; border-radius:6px; margin-bottom:8px;">✔ Concluído</button>
            <hr>
            <label>Cor de fundo</label>
            <input type="color" id="vx-bg" value="${rgbToHex(computed.backgroundColor)}">
            <label>Cor do texto</label>
            <input type="color" id="vx-color" value="${rgbToHex(computed.color)}">
            <label>Tamanho da fonte</label>
            <input type="range" id="vx-font-size" min="8" max="48" value="${parseInt(computed.fontSize)}">
            <label>Arredondamento</label>
            <input type="range" id="vx-border-radius" min="0" max="30" value="${parseInt(computed.borderRadius)}">
            <label>Margem interna</label>
            <input type="range" id="vx-padding" min="0" max="48" value="${parseInt(computed.paddingTop)}">
            <hr>
            <button id="vx-save-theme" style="background:#cba6f7; color:#1e1e2e; border:none; padding:10px; border-radius:6px; width:100%;">💾 Salvar Tema</button>
            <button id="vx-remove-style" style="background:#f38ba8; color:#1e1e2e; border:none; padding:10px; border-radius:6px; width:100%; margin-top:4px;">🗑 Remover Estilo</button>
        `;

        document.getElementById('vx-done-btn').onclick = () => {
            selectedElement = null;
            buildPanelContent();
        };

        document.getElementById('vx-bg').oninput = function() {
            el.style.backgroundColor = this.value;
            updateElementStyle(selector, 'background-color', this.value);
        };
        document.getElementById('vx-color').oninput = function() {
            el.style.color = this.value;
            updateElementStyle(selector, 'color', this.value);
        };
        document.getElementById('vx-font-size').oninput = function() {
            el.style.fontSize = this.value + 'px';
            updateElementStyle(selector, 'font-size', this.value + 'px');
        };
        document.getElementById('vx-border-radius').oninput = function() {
            el.style.borderRadius = this.value + 'px';
            updateElementStyle(selector, 'border-radius', this.value + 'px');
        };
        document.getElementById('vx-padding').oninput = function() {
            el.style.padding = this.value + 'px';
            updateElementStyle(selector, 'padding', this.value + 'px');
        };

        document.getElementById('vx-save-theme').onclick = () => {
            saveStyles();
            applyAllStyles();
            alert('Tema salvo com sucesso! Ele será aplicado automaticamente ao recarregar.');
        };

        document.getElementById('vx-remove-style').onclick = () => {
            delete customStyles[selector];
            el.removeAttribute('style');
            saveStyles();
            applyAllStyles();
            selectedElement = null;
            buildPanelContent();
        };
    }

    function updateElementStyle(selector, property, value) {
        if (!customStyles[selector]) customStyles[selector] = {};
        customStyles[selector][property] = value;
    }

    // Seleção de elementos
    function enableSelectionMode() {
        editorEnabled = true;
        document.body.style.cursor = 'crosshair';
        document.addEventListener('click', onElementClick, true);
    }

    function disableSelectionMode() {
        editorEnabled = false;
        document.body.style.cursor = '';
        document.removeEventListener('click', onElementClick, true);
    }

    function onElementClick(e) {
        if (!editorEnabled) return;
        e.preventDefault();
        e.stopPropagation();
        selectedElement = e.target;
        buildPanelContent();
    }

    // Utilitários
    function rgbToHex(rgb) {
        if (!rgb || rgb === 'transparent') return '#ffffff';
        const match = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
        if (!match) return rgb;
        return "#" + ((1 << 24) + (parseInt(match[1]) << 16) + (parseInt(match[2]) << 8) + parseInt(match[3])).toString(16).slice(1);
    }

    function getUniqueSelector(el) {
        if (el.id) return '#' + el.id;
        const path = [];
        while (el && el !== document.body) {
            let selector = el.tagName.toLowerCase();
            if (el.classList.length) selector += '.' + Array.from(el.classList).join('.');
            path.unshift(selector);
            el = el.parentElement;
        }
        return path.join(' > ');
    }

    // Botão flutuante
    function createButton() {
        floatingBtn = document.createElement('button');
        floatingBtn.textContent = '🛠️';
        floatingBtn.style.cssText = `
            position:fixed; top:10px; right:16px; z-index:99998;
            width:48px; height:48px; border-radius:50%;
            background:#f9e2af; color:#1e1e2e; border:none;
            font-size:24px; box-shadow:0 4px 12px rgba(0,0,0,0.4); cursor:pointer;
        `;
        floatingBtn.onclick = () => togglePanel(panel.style.transform === 'translateX(0px)' ? false : true);
        document.body.appendChild(floatingBtn);
    }

    function init() {
        loadStyles();
        applyAllStyles();
        createPanel();
        createButton();
    }

    if (document.body) init();
    else document.addEventListener('DOMContentLoaded', init);
})();

