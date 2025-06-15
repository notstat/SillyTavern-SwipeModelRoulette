import { getContext, extension_settings } from "../../../extensions.js";
import { eventSource, event_types, saveSettingsDebounced } from "../../../../script.js";

const extensionName = "SillyTavern-SwipeModelRoulette";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const defaultSettings = {
    enabled: false,
    profileWeights: {}
};

let originalProfile = null;
let isSwipeActive = false;
let isProfileSwitching = false;

jQuery(async () => {
    loadSettings();
    
    eventSource.on(event_types.MESSAGE_SWIPED, handleSwipeStart);
    eventSource.on(event_types.GENERATION_ENDED, handleSwipeEnd);
    eventSource.on(event_types.GENERATION_STOPPED, handleSwipeEnd);
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, handleSwipeEnd);
    
    $(document).on('change', '#main_api', interceptCancelStatusCheck);
    
    setTimeout(interceptCancelStatusCheck, 1000);
    
    addSettingsUI();
});

function loadSettings() {
    if (!extension_settings[extensionName]) {
        extension_settings[extensionName] = {};
    }
    
    for (const key of Object.keys(defaultSettings)) {
        if (extension_settings[extensionName][key] === undefined) {
            extension_settings[extensionName][key] = defaultSettings[key];
        }
    }
}

function addSettingsUI() {
    const settingsHtml = `
    <div class="swipe-roulette-settings">
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>Swipe Model Roulette</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <div style="margin-bottom: 10px;">
                    <label class="checkbox_label" for="swipe_roulette_enabled">
                        <input type="checkbox" id="swipe_roulette_enabled">
                        <small>Enabled</small>
                    </label>
                </div>
                
                <div class="swipe-roulette-description" style="margin-bottom: 15px; font-size: 0.9em; opacity: 0.8;">
                    Set the chance (%) for each connection profile to be used during swipes
                </div>
                
                <div id="swipe_roulette_profiles_container" style="max-height: 250px; overflow-y: auto; padding-right: 10px;">
                </div>
                
                <div class="swipe-roulette-total" style="margin-top: 10px; padding: 10px; background-color: var(--black50a); border-radius: 5px;">
                    <strong>Total: <span id="swipe_roulette_total">0</span>%</strong>
                    <span id="swipe_roulette_warning" style="color: var(--warning); margin-left: 10px; display: none;">
                        (Should be 100%)
                    </span>
                </div>
            </div>
        </div>
    </div>`;
    
    $("#extensions_settings").append(settingsHtml);
    
    $("#swipe_roulette_enabled").prop("checked", extension_settings[extensionName].enabled);
    
    $("#swipe_roulette_enabled").on("change", function() {
        extension_settings[extensionName].enabled = $(this).prop("checked");
        saveSettingsDebounced();
    });
    
    updateProfileList();
    
    eventSource.on(event_types.SETTINGS_LOADED, updateProfileList);
    eventSource.on(event_types.SETTINGS_UPDATED, updateProfileList);
}

function updateProfileList() {
    const context = getContext();
    const profiles = context.extensionSettings?.connectionManager?.profiles || [];
    const container = $("#swipe_roulette_profiles_container");
    
    container.empty();
    
    if (profiles.length === 0) {
        container.html('<div style="opacity: 0.6;">No connection profiles found</div>');
        return;
    }
    
    const noneProfile = { id: 'none', name: 'None' };
    const allProfiles = [noneProfile, ...profiles];
    
    allProfiles.forEach(profile => {
        const weight = extension_settings[extensionName].profileWeights[profile.id] || 0;
        
        const profileHtml = `
        <div class="swipe-roulette-profile" data-profile-id="${profile.id}" style="margin-bottom: 10px;">
            <div class="range-block">
                <div class="range-block-title" style="margin-bottom: 5px;">
                    <small>${profile.name}</small>
                </div>
                <div class="range-block-range-and-counter">
                    <div class="range-block-range">
                        <input type="range" 
                               class="swipe-roulette-weight-slider" 
                               data-profile-id="${profile.id}"
                               min="0" 
                               max="100" 
                               step="1" 
                               value="${weight}">
                    </div>
                    <div class="range-block-counter">
                        <input type="number" 
                               class="swipe-roulette-weight-input" 
                               data-profile-id="${profile.id}"
                               min="0" 
                               max="100" 
                               value="${weight}">
                        <span style="margin-left: 2px;">%</span>
                    </div>
                </div>
            </div>
        </div>`;
        
        container.append(profileHtml);
    });
    
    $(".swipe-roulette-weight-slider").on("input", function() {
        const profileId = $(this).data("profile-id");
        const value = parseInt($(this).val());
        
        $(`.swipe-roulette-weight-input[data-profile-id="${profileId}"]`).val(value);
        
        extension_settings[extensionName].profileWeights[profileId] = value;
        saveSettingsDebounced();
        
        updateTotal();
    });
    
    $(".swipe-roulette-weight-input").on("input", function() {
        const profileId = $(this).data("profile-id");
        let value = parseInt($(this).val()) || 0;
        
        value = Math.max(0, Math.min(100, value));
        $(this).val(value);
        
        $(`.swipe-roulette-weight-slider[data-profile-id="${profileId}"]`).val(value);
        
        extension_settings[extensionName].profileWeights[profileId] = value;
        saveSettingsDebounced();
        
        updateTotal();
    });
    
    $(".swipe-roulette-weight-input").on("blur", function() {
        autoBalanceWeights();
    });
    
    updateTotal();
}

function updateTotal() {
    const weights = extension_settings[extensionName].profileWeights;
    const total = Object.values(weights).reduce((sum, weight) => sum + (weight || 0), 0);
    
    $("#swipe_roulette_total").text(total);
    
    if (total !== 100 && total > 0) {
        $("#swipe_roulette_warning").show();
    } else {
        $("#swipe_roulette_warning").hide();
    }
}

function autoBalanceWeights() {
    const weights = extension_settings[extensionName].profileWeights;
    const total = Object.values(weights).reduce((sum, weight) => sum + (weight || 0), 0);
    
    if (total === 0 || total === 100) return;
    
    const scale = 100 / total;
    
    Object.keys(weights).forEach(profileId => {
        const newWeight = Math.round(weights[profileId] * scale);
        weights[profileId] = newWeight;
        
        $(`.swipe-roulette-weight-slider[data-profile-id="${profileId}"]`).val(newWeight);
        $(`.swipe-roulette-weight-input[data-profile-id="${profileId}"]`).val(newWeight);
    });
    
    const newTotal = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    if (newTotal !== 100) {
        const largestWeightProfile = Object.keys(weights).reduce((a, b) => 
            weights[a] > weights[b] ? a : b
        );
        weights[largestWeightProfile] += (100 - newTotal);
        
        $(`.swipe-roulette-weight-slider[data-profile-id="${largestWeightProfile}"]`).val(weights[largestWeightProfile]);
        $(`.swipe-roulette-weight-input[data-profile-id="${largestWeightProfile}"]`).val(weights[largestWeightProfile]);
    }
    
    saveSettingsDebounced();
    updateTotal();
}

function selectRandomProfile(profiles) {
    const weights = extension_settings[extensionName].profileWeights;
    const weightedProfiles = [];
    
    if (weights['none'] > 0) {
        weightedProfiles.push({ profile: null, weight: weights['none'] });
    }
    
    profiles.forEach(profile => {
        const weight = weights[profile.id] || 0;
        if (weight > 0) {
            weightedProfiles.push({ profile, weight });
        }
    });
    
    if (weightedProfiles.length === 0) {
        return profiles[Math.floor(Math.random() * profiles.length)];
    }
    
    const totalWeight = weightedProfiles.reduce((sum, item) => sum + item.weight, 0);
    
    let random = Math.random() * totalWeight;
    
    for (const item of weightedProfiles) {
        random -= item.weight;
        if (random <= 0) {
            return item.profile;
        }
    }
    
    return profiles[0];
}

function interceptCancelStatusCheck() {
    const mainApiElement = document.getElementById('main_api');
    if (!mainApiElement) return;
    
    const changeEvent = $._data(mainApiElement, 'events')?.change;
    if (!changeEvent || !changeEvent.length) return;
    
    for (const handler of changeEvent) {
        const handlerString = handler.handler.toString();
        if (handlerString.includes('cancelStatusCheck')) {
            const originalHandler = handler.handler;
            
            handler.handler = function(...args) {
                if (isProfileSwitching) {
                    return;
                }
                
                return originalHandler.apply(this, args);
            };
            
            break;
        }
    }
}

async function handleSwipeStart(messageId) {
    if (!extension_settings[extensionName].enabled) {
        return;
    }
    
    if (isSwipeActive) {
        return;
    }
    
    isSwipeActive = true;
    
    const context = getContext();
    const { extensionSettings, SlashCommandParser } = context;
    
    const currentProfileId = extensionSettings.connectionManager?.selectedProfile;
    const profiles = extensionSettings.connectionManager?.profiles || [];
    
    if (profiles.length === 0) {
        isSwipeActive = false;
        return;
    }
    
    if (currentProfileId) {
        originalProfile = profiles.find(p => p.id === currentProfileId);
    } else {
        originalProfile = null;
    }
    
    const randomProfile = selectRandomProfile(profiles);
    
    isProfileSwitching = true;
    
    try {
        await SlashCommandParser.commands['profile'].callback(
            { await: 'true' },
            randomProfile ? randomProfile.name : 'None'
        );
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
    } catch (error) {
        isSwipeActive = false;
    } finally {
        setTimeout(() => {
            isProfileSwitching = false;
        }, 1000);
    }
}

async function handleSwipeEnd() {
    if (!isSwipeActive) {
        return;
    }
    
    const context = getContext();
    const { chat } = context;
    
    const lastMessage = chat[chat.length - 1];
    if (!lastMessage || lastMessage.swipe_id === undefined) {
        return;
    }
    
    isSwipeActive = false;
    
    if (originalProfile) {
        const { SlashCommandParser } = getContext();
        
        isProfileSwitching = true;
        
        try {
            await SlashCommandParser.commands['profile'].callback(
                { await: 'true' },
                originalProfile.name
            );
        } catch (error) {
        } finally {
            setTimeout(() => {
                isProfileSwitching = false;
            }, 1000);
        }
    } else {
        const { SlashCommandParser } = getContext();
        
        isProfileSwitching = true;
        
        try {
            await SlashCommandParser.commands['profile'].callback(
                { await: 'true' },
                'None'
            );
        } catch (error) {
        } finally {
            setTimeout(() => {
                isProfileSwitching = false;
            }, 1000);
        }
    }
    
    originalProfile = null;
}

setTimeout(() => {
    const context = getContext();
    const profiles = context.extensionSettings?.connectionManager?.profiles || [];
}, 1000);
