precision mediump float;

// uniform int u_colorTable[0x8000];
// uniform int u_intensityColorTable[65536];
// uniform vec3 u_paletteRGB[256];

uniform sampler2D u_colorTable;
uniform sampler2D u_intensityColorTable;
uniform sampler2D u_paletteRGB;

uniform sampler2D u_image;
uniform sampler2D u_lightBuffer;

varying vec2 v_texCoord;

int colorToColorTableRGB(const vec3 color) {
    // Get 5-bit "paletted" RGB values
    // for this to work, r, g, and b need to be in the range 0..31 (5 bits)
    //vec3 v = vec3(color.x*255 / 8, color.y*255 / 8, color.z*255 / 8); // Get 5-bit "paletted" RGB values
    int r = int(color.r * 255.0) / 8;
    int g = int(color.g * 255.0) / 8;
    int b = int(color.b * 255.0) / 8;

    // r << 10 | g << 5 | b
    return 32 * 32 * r + 32 * g + b;
}

vec4 atIndex(sampler2D tex, int index) {
    const float size = 256.0; // max size of texture
    float x = mod(float(index), size);
    float y = /* 1.0 - */ float(index / int(size)); // use upside-down V coordinates because OpenGL likes textures bottom-to-top but we don't play their game
    return texture2D(tex, vec2((x + 0.5) / size, (y + 0.5) / size));
}

vec3 paletteColor(int palIdx) {
    return texture2D(u_paletteRGB, vec2((float(palIdx) + 0.5) / 256.0, 1.0)).rgb;
}

void main() {
    vec4 tileTexel = texture2D(u_image, v_texCoord);
    vec4 light = texture2D(u_lightBuffer, v_texCoord);

    float lightIntensity = min(light.r, 65536.0);

    int colorIdx = colorToColorTableRGB(tileTexel.rgb);
    int palIdx = int(atIndex(u_colorTable, colorIdx).r);
    int tableIdx = palIdx * 256 + int(lightIntensity / 512.0);
    int colorPal = int(atIndex(u_intensityColorTable, tableIdx).r);
    vec3 color = paletteColor(colorPal);

    gl_FragColor = vec4(color, tileTexel.a);
}