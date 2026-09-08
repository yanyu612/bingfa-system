/**
 * 角色世界书与 Lore API 预设管理
 * @module config/presets
 */

import { loadConfig, saveConfig } from './config-manager';

function createId(prefix) {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `${prefix}-${crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function cleanName(name) {
    return String(name || '').trim();
}

export function getRoleWorldbookPresets() {
    const config = loadConfig();
    return Array.isArray(config?.roleWorldbookPresets)
        ? config.roleWorldbookPresets
        : [];
}

export function saveRoleWorldbookPreset(preset) {
    const name = cleanName(preset?.name);
    const memoryBook = cleanName(preset?.memoryBook);
    const loreBook = cleanName(preset?.loreBook);
    if (!name || !memoryBook || !loreBook) {
        throw new Error('角色预设需要名称、Memory 世界书和 Lore 世界书');
    }

    const config = loadConfig();
    if (!Array.isArray(config.roleWorldbookPresets)) {
        config.roleWorldbookPresets = [];
    }

    const now = Date.now();
    const existingIndex = config.roleWorldbookPresets.findIndex(
        (item) => item.id === preset.id,
    );
    const value = {
        id: preset.id || createId('role-books'),
        name,
        memoryBook,
        loreBook,
        createdAt:
            existingIndex >= 0
                ? config.roleWorldbookPresets[existingIndex].createdAt || now
                : now,
        updatedAt: now,
    };

    if (existingIndex >= 0) {
        config.roleWorldbookPresets[existingIndex] = value;
    } else {
        config.roleWorldbookPresets.push(value);
    }
    saveConfig(config);
    return value;
}

export function deleteRoleWorldbookPreset(id) {
    const config = loadConfig();
    const presets = Array.isArray(config.roleWorldbookPresets)
        ? config.roleWorldbookPresets
        : [];
    const next = presets.filter((item) => item.id !== id);
    if (next.length === presets.length) return false;
    config.roleWorldbookPresets = next;
    saveConfig(config);
    return true;
}

export function getLoreApiPresets() {
    const config = loadConfig();
    return Array.isArray(config?.loreApiPresets) ? config.loreApiPresets : [];
}

export function saveLoreApiPreset(preset) {
    const name = cleanName(preset?.name);
    const apiUrl = cleanName(preset?.apiUrl);
    const model = cleanName(preset?.model);
    if (!name || !apiUrl || !model) {
        throw new Error('Lore API 预设需要名称、API URL 和模型');
    }

    const config = loadConfig();
    if (!Array.isArray(config.loreApiPresets)) config.loreApiPresets = [];

    const now = Date.now();
    const existingIndex = config.loreApiPresets.findIndex(
        (item) => item.id === preset.id,
    );
    const value = {
        id: preset.id || createId('lore-api'),
        name,
        apiFormat: cleanName(preset.apiFormat) || 'openai',
        apiUrl,
        apiKey: String(preset.apiKey || '').trim(),
        model,
        createdAt:
            existingIndex >= 0
                ? config.loreApiPresets[existingIndex].createdAt || now
                : now,
        updatedAt: now,
    };

    if (existingIndex >= 0) {
        config.loreApiPresets[existingIndex] = value;
    } else {
        config.loreApiPresets.push(value);
    }
    saveConfig(config);
    return value;
}

export function deleteLoreApiPreset(id) {
    const config = loadConfig();
    const presets = Array.isArray(config.loreApiPresets)
        ? config.loreApiPresets
        : [];
    const next = presets.filter((item) => item.id !== id);
    if (next.length === presets.length) return false;
    config.loreApiPresets = next;
    saveConfig(config);
    return true;
}
