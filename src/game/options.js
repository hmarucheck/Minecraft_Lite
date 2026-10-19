// Game options persisted in localStorage (per-browser).
const KEY = 'minecraft_lite_options';
const isTouch = typeof window !== 'undefined' && ('ontouchstart' in window) && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);

export const DEFAULT_OPTIONS = {
  fov: 70, renderDistance: isTouch ? 5 : 8, simulationDistance: 8, graphics: 'fancy', smoothLighting: true, maxFps: 260, vsync: true,
  viewBobbing: true, guiScale: 0, attackIndicator: 'crosshair', gamma: 0.5, clouds: 'fancy', fullscreen: false, particles: 'all',
  mipmapLevels: 4, entityShadows: true, distortionEffects: 1, entityDistance: 1, fovEffects: true, autosaveIndicator: true, biomeBlend: 2,
  sensitivity: 0.5, invertMouse: false, scrollSensitivity: 1, discreteScrolling: false, touchscreen: isTouch, autoJump: isTouch, toggleSneak: false, toggleSprint: false,
  volume_master: 1, volume_music: 0.6, volume_record: 1, volume_weather: 1, volume_block: 1, volume_hostile: 1, volume_neutral: 1, volume_player: 1, volume_ambient: 1, volume_voice: 1,
  showSubtitles: false, directionalAudio: false,
  chatVisibility: 'shown', chatColors: true, chatLinks: true, chatOpacity: 1, textBackgroundOpacity: 0.5, chatScale: 1, chatWidth: 1, chatHeightFocused: 1, chatHeightUnfocused: 0.44, chatLineSpacing: 0, chatDelay: 0,
  narrator: 'off', mainHand: 'right', language: 'en_us', hideMatchedNames: true, onlineMemberList: false,
  skinCape: true, skinJacket: true, skinLeftSleeve: true, skinRightSleeve: true, skinLeftPants: true, skinRightPants: true, skinHat: true,
  highContrast: false, menuBackgroundBlur: 5, darkMojangBackground: false, hideLightningFlash: false, monochromeLogo: false, panoramaSpeed: 1, glintSpeed: 0.5, glintStrength: 0.75, damageTiltStrength: 1, hideSplashTexts: false, notificationTime: 1,
  telemetry: 'minimal', allowServerListing: true, realmsNotifications: true,
  keyBindings: {},
};

export class Options {
  constructor() {
    this.values = { ...DEFAULT_OPTIONS };
    try { const s = localStorage.getItem(KEY); if (s) Object.assign(this.values, JSON.parse(s)); } catch { /* storage unavailable */ }
  }
  get(k) { return this.values[k]; }
  set(k, v) { this.values[k] = v; this.save(); }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.values)); } catch { /* ignore */ } }
}
