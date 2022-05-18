precision mediump float;

uniform sampler2D u_image;
uniform float u_numFrames;
uniform float u_frame;

varying vec2 v_texCoord;

void main() {
    float frameWidth = 1.0 / u_numFrames;
    vec2 coord = v_texCoord;
    coord.x = coord.x / u_numFrames + frameWidth * u_frame;

    gl_FragColor = texture2D(u_image, coord);
}
