/**
 * 世界书选择器弹窗模块
 * @module ui/modals/worldbook-selector
 */

import Logger from '@core/logger';
import { getGlobalSettings } from '@config/config-manager';
import { getImportedBookNames, saveImportedBookNames } from '@config/imported-books';
import {
    deleteRoleWorldbookPreset,
    getRoleWorldbookPresets,
    saveRoleWorldbookPreset,
} from '@config/presets';
import { getAllAvailableWorldBooks, isSummaryBook } from '@worldbook/api';
import { refreshWorldBookList } from '@worldbook/refresh';

// 可用世界书缓存
let availableWorldBooks = [];

/**
 * 转义 HTML，防止 XSS 攻击
 * @param {string} text 原始文本
 * @returns {string} 转义后的文本
 */
function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

/**
 * 创建世界书选择器弹窗
 */
function createWorldBookSelectorModal() {
    if (document.getElementById("mm-worldbook-selector-modal")) return;

    const modal = document.createElement("div");
    modal.id = "mm-worldbook-selector-modal";
    modal.className = "mm-modal";
    modal.innerHTML = `
        <div class="mm-modal-content mm-worldbook-selector">
            <div class="mm-modal-header">
                <h3>选择世界书</h3>
                <button class="mm-modal-close" id="mm-selector-close">&times;</button>
            </div>
            <div class="mm-modal-body">
                <div class="mm-selector-preset-panel">
                    <label for="mm-role-worldbook-preset">角色世界书预设</label>
                    <div class="mm-selector-preset-row">
                        <select id="mm-role-worldbook-preset">
                            <option value="">--- 选择 Memory + Lore 配套 ---</option>
                        </select>
                        <button type="button" class="mm-btn mm-btn-primary" id="mm-role-preset-apply">应用配套</button>
                    </div>
                    <div class="mm-selector-preset-actions">
                        <button type="button" class="mm-btn mm-btn-secondary" id="mm-role-preset-save">把当前勾选保存为预设</button>
                        <button type="button" class="mm-btn" id="mm-role-preset-delete">删除所选预设</button>
                    </div>
                    <small class="mm-hint">每个预设恰好保存一本 Memory 和一本 Lore；应用后会替换当前导入的世界书。</small>
                </div>
                <div class="mm-selector-hint">
                    <i class="fa-solid fa-info-circle"></i>
                    勾选要导入的世界书，插件将自动检测并处理这些世界书
                </div>
                <div class="mm-selector-list" id="mm-selector-list">
                    <div class="mm-loading">加载中...</div>
                </div>
            </div>
            <div class="mm-modal-footer">
                <button class="mm-btn" id="mm-selector-cancel">取消</button>
                <button class="mm-btn mm-btn-primary" id="mm-selector-confirm">确认导入</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // 绑定事件
    document
        .getElementById("mm-selector-close")
        .addEventListener("click", hideWorldBookSelector);
    document
        .getElementById("mm-selector-cancel")
        .addEventListener("click", hideWorldBookSelector);
    document
        .getElementById("mm-selector-confirm")
        .addEventListener("click", confirmImportWorldBooks);
    document
        .getElementById("mm-role-worldbook-preset")
        .addEventListener("change", previewSelectedRolePreset);
    document
        .getElementById("mm-role-preset-apply")
        .addEventListener("click", applySelectedRolePreset);
    document
        .getElementById("mm-role-preset-save")
        .addEventListener("click", saveCurrentRolePreset);
    document
        .getElementById("mm-role-preset-delete")
        .addEventListener("click", deleteSelectedRolePreset);
}

function getCheckedBookNames() {
    const listContainer = document.getElementById("mm-selector-list");
    if (!listContainer) return [];
    return Array.from(listContainer.querySelectorAll('input[type="checkbox"]:checked'))
        .map((checkbox) => checkbox.value);
}

function renderRolePresetOptions(importedNames = getImportedBookNames(), selectedId = "") {
    const select = document.getElementById("mm-role-worldbook-preset");
    if (!select) return;

    const presets = getRoleWorldbookPresets();
    select.innerHTML = '<option value="">--- 选择 Memory + Lore 配套 ---</option>';
    for (const preset of presets) {
        const option = document.createElement("option");
        option.value = preset.id;
        option.textContent = `${preset.name}（${preset.memoryBook} + ${preset.loreBook}）`;
        select.appendChild(option);
    }

    const matched = presets.find(
        (preset) =>
            importedNames.length === 2 &&
            importedNames.includes(preset.memoryBook) &&
            importedNames.includes(preset.loreBook),
    );
    select.value = selectedId || matched?.id || "";
}

function getSelectedRolePreset() {
    const select = document.getElementById("mm-role-worldbook-preset");
    if (!select?.value) return null;
    return getRoleWorldbookPresets().find((preset) => preset.id === select.value) || null;
}

function selectOnlyPresetBooks(preset) {
    const listContainer = document.getElementById("mm-selector-list");
    if (!listContainer || !preset) return false;

    const required = [preset.memoryBook, preset.loreBook];
    const missing = required.filter((bookName) => !availableWorldBooks.includes(bookName));
    if (missing.length > 0) {
        alert(`这个预设中的世界书已不存在：${missing.join("、")}`);
        return false;
    }

    listContainer.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
        checkbox.checked = required.includes(checkbox.value);
    });
    return true;
}

function previewSelectedRolePreset() {
    const preset = getSelectedRolePreset();
    if (preset) selectOnlyPresetBooks(preset);
}

async function applySelectedRolePreset() {
    const preset = getSelectedRolePreset();
    if (!preset) {
        alert("请先选择一个角色世界书预设");
        return;
    }
    if (!selectOnlyPresetBooks(preset)) return;

    saveImportedBookNames([preset.memoryBook, preset.loreBook]);
    hideWorldBookSelector();
    Logger.log(`已应用角色世界书预设：${preset.name}`);
    await refreshWorldBookList();
}

function saveCurrentRolePreset() {
    const selectedBooks = getCheckedBookNames();
    const memoryBooks = selectedBooks.filter((name) => !isSummaryBook(name));
    const loreBooks = selectedBooks.filter((name) => isSummaryBook(name));
    if (selectedBooks.length !== 2 || memoryBooks.length !== 1 || loreBooks.length !== 1) {
        alert("请恰好勾选一本 Memory 世界书和一本 Lore 世界书");
        return;
    }

    const selectedPreset = getSelectedRolePreset();
    const name = prompt("给这组角色世界书预设起个名字", selectedPreset?.name || "");
    if (!name?.trim()) return;

    const presets = getRoleWorldbookPresets();
    const duplicate = presets.find(
        (preset) => preset.name.toLowerCase() === name.trim().toLowerCase(),
    );
    const target = selectedPreset || duplicate;
    if (target && !confirm(`确定用当前勾选覆盖预设“${target.name}”吗？`)) return;

    const saved = saveRoleWorldbookPreset({
        id: target?.id,
        name: name.trim(),
        memoryBook: memoryBooks[0],
        loreBook: loreBooks[0],
    });
    renderRolePresetOptions(selectedBooks, saved.id);
    Logger.log(`已保存角色世界书预设：${saved.name}`);
}

function deleteSelectedRolePreset() {
    const preset = getSelectedRolePreset();
    if (!preset) {
        alert("请先选择要删除的角色世界书预设");
        return;
    }
    if (!confirm(`确定删除角色世界书预设“${preset.name}”吗？`)) return;
    deleteRoleWorldbookPreset(preset.id);
    renderRolePresetOptions();
}

/**
 * 显示世界书选择器弹窗
 */
export async function showWorldBookSelector() {
    createWorldBookSelectorModal();

    const modal = document.getElementById("mm-worldbook-selector-modal");
    const listContainer = document.getElementById("mm-selector-list");

    // 应用当前主题
    const settings = getGlobalSettings();
    const theme = settings.theme || "default";
    if (theme !== "default") {
        modal.setAttribute("data-mm-theme", theme);
    }

    modal.classList.add("mm-modal-visible");
    listContainer.innerHTML =
        '<div class="mm-loading"><i class="fa-solid fa-spinner fa-spin"></i> 正在获取世界书列表...</div>';

    try {
        availableWorldBooks = await getAllAvailableWorldBooks();
        const importedNames = getImportedBookNames();

        if (availableWorldBooks.length === 0) {
            listContainer.innerHTML = `
                <div class="mm-empty-state">
                    <i class="fa-solid fa-book"></i>
                    <p>未找到任何世界书</p>
                </div>`;
            return;
        }

        let html = "";
        for (const bookName of availableWorldBooks) {
            const isImported = importedNames.includes(bookName);
            const bookType = isSummaryBook(bookName) ? "Lore" : "Memory";
            const typeClass = isSummaryBook(bookName)
                ? "mm-type-summary"
                : "mm-type-memory";

            const safeBookName = escapeHtml(bookName);
            html += `
                <label class="mm-selector-item">
                    <input type="checkbox" value="${safeBookName}" ${
                        isImported ? "checked" : ""
                    }>
                    <span class="mm-selector-checkbox"></span>
                    <span class="mm-selector-name">${safeBookName}</span>
                    <span class="mm-selector-type ${typeClass}">${bookType}</span>
                </label>`;
        }

        listContainer.innerHTML = html;
        renderRolePresetOptions(importedNames);
    } catch (error) {
        Logger.error("获取世界书列表失败:", error);
        const safeErrorMsg = escapeHtml(error.message);
        listContainer.innerHTML = `
            <div class="mm-error-state">
                <i class="fa-solid fa-exclamation-triangle"></i>
                <p>加载失败: ${safeErrorMsg}</p>
            </div>`;
    }
}

/**
 * 隐藏世界书选择器弹窗
 */
export function hideWorldBookSelector() {
    const modal = document.getElementById("mm-worldbook-selector-modal");
    if (modal) {
        modal.classList.remove("mm-modal-visible");
    }
}

/**
 * 确认导入世界书
 */
async function confirmImportWorldBooks() {
    const listContainer = document.getElementById("mm-selector-list");
    const checkboxes = listContainer.querySelectorAll('input[type="checkbox"]');

    const selectedBooks = [];
    checkboxes.forEach((cb) => {
        if (cb.checked) {
            selectedBooks.push(cb.value);
        }
    });

    saveImportedBookNames(selectedBooks);
    hideWorldBookSelector();

    Logger.log(`已导入 ${selectedBooks.length} 个世界书`);
    await refreshWorldBookList();
}
