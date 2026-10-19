// GLSL for world rendering.
export const BLOCK_VERT = /* glsl */`
precision highp float;
in vec3 aTex;
in vec4 aColor;
in vec2 aLight;
uniform float uTime;
out vec2 vUv;
flat out float vLayer;
out vec4 vColor;
out vec2 vLight;
out float vDist;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float layer = aTex.x;
  if (aTex.y > 1.5) layer += mod(floor(uTime / max(aTex.z, 1.0)), aTex.y);
  vLayer = layer;
  vUv = uv;
  vColor = aColor;
  vLight = aLight;
  vDist = length(mv.xyz);
}
`;

export const LIGHT_FUNCS = /* glsl */`
uniform float uDay;
uniform vec3 uSkyLightColor;
uniform float uGamma;
uniform float uNightVision;
uniform float uFlash;
float lcurve(float x) { return x / (4.0 - 3.0 * x); }
vec3 lightColor(vec2 l) {
  float sky = lcurve(l.x) * uDay;
  float blk = lcurve(l.y);
  vec3 c = max(vec3(sky) * uSkyLightColor, vec3(blk) * vec3(1.0, 0.93, 0.8));
  c = mix(c, 1.0 - pow(1.0 - c, vec3(4.0)), uGamma);
  c = max(c, vec3(0.035));
  c = mix(c, vec3(1.0), uNightVision);
  c += vec3(uFlash);
  return min(c, vec3(1.0));
}
`;

export const BLOCK_FRAG = /* glsl */`
precision highp float;
out vec4 outColor;
precision highp sampler2DArray;
uniform sampler2DArray uAtlas;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uAlphaTest;
uniform float uOpacity;
${LIGHT_FUNCS}
in vec2 vUv;
flat in float vLayer;
in vec4 vColor;
in vec2 vLight;
in float vDist;
void main() {
  vec4 t = texture(uAtlas, vec3(vUv, vLayer));
  if (t.a < uAlphaTest) discard;
  vec3 c = t.rgb * vColor.rgb * lightColor(vLight);
  float f = clamp((vDist - uFogNear) / max(uFogFar - uFogNear, 0.001), 0.0, 1.0);
  c = mix(c, uFogColor, f);
  outColor = vec4(c, t.a * vColor.a * uOpacity);
}
`;

// Sky dome: gradient from fog colour at the horizon to sky colour overhead + sunrise glow
export const SKY_VERT = /* glsl */`
out vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * mat4(mat3(modelViewMatrix)) * vec4(position, 1.0);
  gl_Position = p.xyww;
}
`;
export const SKY_FRAG = /* glsl */`
precision highp float;
out vec4 outColor;
uniform vec3 uSkyColor;
uniform vec3 uFogColor;
uniform vec4 uSunrise;
uniform vec3 uSunDir;
uniform float uVoid;
in vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 c = mix(uFogColor, uSkyColor, smoothstep(-0.02, 0.35, h));
  if (h < -0.02) c = mix(uFogColor, uFogColor * 0.2 * uVoid + uFogColor * (1.0 - uVoid), smoothstep(-0.02, -0.3, h));
  // sunrise / sunset fan
  if (uSunrise.a > 0.0) {
    vec3 sd = normalize(vec3(uSunDir.x, 0.0, uSunDir.z));
    float facing = max(dot(normalize(vec3(d.x, 0.0, d.z)), sd), 0.0);
    float band = exp(-abs(h - 0.05) * 5.0) * pow(facing, 3.0);
    c = mix(c, uSunrise.rgb, clamp(band * uSunrise.a, 0.0, 1.0));
  }
  outColor = vec4(c, 1.0);
}
`;

export const SIMPLE_TEX_VERT = /* glsl */`
out vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
export const SIMPLE_TEX_FRAG = /* glsl */`
precision highp float;
out vec4 outColor;
uniform sampler2D uMap;
uniform float uAlpha;
uniform vec3 uTint;
in vec2 vUv;
void main() { vec4 t = texture(uMap, vUv); outColor = vec4(t.rgb * uTint, t.a * uAlpha); }
`;

// Entities: lit by a uniform brightness, with hurt flash
export const ENTITY_VERT = /* glsl */`
out vec2 vUv;
out float vShade;
out float vDist;
void main() {
  vUv = uv;
  vec3 n = normalize(mat3(modelMatrix) * normal);
  vShade = 0.6 + 0.4 * max(n.y, 0.0) + 0.2 * abs(n.x) * 0.0 + (n.y < -0.5 ? -0.1 : 0.0) + abs(n.z) * 0.2;
  vShade = min(vShade, 1.0);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDist = length(mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;
export const ENTITY_FRAG = /* glsl */`
precision highp float;
out vec4 outColor;
uniform sampler2D uMap;
uniform vec2 uLight;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform vec4 uOverlay;
uniform float uAlpha;
${LIGHT_FUNCS}
in vec2 vUv;
in float vShade;
in float vDist;
void main() {
  vec4 t = texture(uMap, vUv);
  if (t.a < 0.1) discard;
  vec3 c = t.rgb * vShade * lightColor(uLight);
  c = mix(c, uOverlay.rgb, uOverlay.a);
  float f = clamp((vDist - uFogNear) / max(uFogFar - uFogNear, 0.001), 0.0, 1.0);
  c = mix(c, uFogColor, f);
  outColor = vec4(c, t.a * uAlpha);
}
`;
