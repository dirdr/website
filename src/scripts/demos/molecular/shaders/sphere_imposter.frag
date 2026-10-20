#version 300 es
precision highp float;

in vec2 v_uv_coordinates;
in vec3 v_world_pos;
in vec3 v_center;
in vec4 v_color;
in float v_radius;

out vec4 frag_color;

uniform vec3 light_position;
uniform vec3 camera_position;
uniform mat4 projection;
uniform mat4 view;

void main() {
    
    vec2 pos = v_uv_coordinates * 2.0 - 1.0;

    vec3 ray_origin = camera_position;
    vec3 ray_dir = normalize(v_world_pos - camera_position);
    vec3 sphere_center = v_center;

    vec3 oc = ray_origin - sphere_center;
    float a = dot(ray_dir, ray_dir);
    float b = 2.0 * dot(ray_dir, oc);
    float c = dot(oc, oc) - v_radius * v_radius;
    float discriminant = b * b - 4.0 * a * c;

    if (discriminant < 0.0) discard;

    if (length(pos) > 1.0) {
        discard;
    }

    float t = (-b - sqrt(discriminant)) / (2.0 * a);
    vec3 intersection = ray_origin + t * ray_dir;

    vec3 normal = normalize(intersection - sphere_center);

    vec3 light_dir = normalize(light_position - intersection);
    float distance_to_light = distance(light_position, intersection);

    float attenuation = 1.0 / (1.0 + 0.09 * distance_to_light + 0.032 * distance_to_light * distance_to_light);

    float diffuse = max(dot(normal, light_dir), 0.0) * attenuation;

    vec3 view_dir = normalize(camera_position - intersection);
    vec3 reflect_dir = reflect(-light_dir, normal);
    float shininess = 16.0; 
    float specular = pow(max(dot(view_dir, reflect_dir), 0.0), shininess) * attenuation;

    vec3 ambient_light = vec3(0.3, 0.3, 0.4); 
    vec3 ambient = ambient_light * 0.7;

    vec3 final_color = v_color.rgb * (ambient + diffuse) + specular;

    vec4 clip_space = projection * view * vec4(intersection, 1.0);
    float ndc_depth = clip_space.z / clip_space.w;
    float window_depth = (ndc_depth * 0.5) + 0.5; 

    float depth_bias = 0.0001;
    gl_FragDepth = window_depth + depth_bias;

    frag_color = vec4(final_color, v_color.a);
}
