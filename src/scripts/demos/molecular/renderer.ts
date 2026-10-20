import sphereVertex from './shaders/sphere_imposter.vert?raw';
import sphereFragment from './shaders/sphere_imposter.frag?raw';
import bondVertex from './shaders/cylinder_imposter.vert?raw';
import bondFragment from './shaders/cylinder_imposter.frag?raw';
import type { Molecule } from './molecule-data';
import {
  perspective,
  rotationMatrix,
  viewMatrix,
  type Quaternion,
} from './transforms';

class Batch {
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private geometry: WebGLBuffer;
  private instances: WebGLBuffer;
  private count = 0;
  private uniforms = new Map<string, WebGLUniformLocation | null>();

  constructor(
    private gl: WebGL2RenderingContext,
    vertex: string,
    fragment: string,
    attributes: number[],
  ) {
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error('Could not create shader');
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const error = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(`Shader compilation failed: ${error}`);
      }
      return shader;
    };
    const vs = compile(gl.VERTEX_SHADER, vertex),
      fs = compile(gl.FRAGMENT_SHADER, fragment);
    const program = gl.createProgram();
    if (!program) throw new Error('Could not create renderer');
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const error = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`Shader linking failed: ${error}`);
    }
    this.program = program;
    this.vao = gl.createVertexArray()!;
    this.geometry = gl.createBuffer()!;
    this.instances = gl.createBuffer()!;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.geometry);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -0.5, -0.5, 0, 0, 0, 0.5, -0.5, 0, 1, 0, -0.5, 0.5, 0, 0, 1, 0.5, 0.5,
        0, 1, 1,
      ]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instances);
    const stride = attributes.reduce((a, b) => a + b, 0) * 4;
    let offset = 0;
    attributes.forEach((size, index) => {
      gl.enableVertexAttribArray(index + 2);
      gl.vertexAttribPointer(index + 2, size, gl.FLOAT, false, stride, offset);
      gl.vertexAttribDivisor(index + 2, 1);
      offset += size * 4;
    });
    gl.bindVertexArray(null);
    for (const name of [
      'model',
      'projection',
      'view',
      'camera_position',
      'light_position',
    ]) {
      this.uniforms.set(name, gl.getUniformLocation(program, name));
    }
  }

  update(data: Float32Array, count: number) {
    this.count = count;
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.instances);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, data, this.gl.STATIC_DRAW);
  }

  draw(
    model: Float32Array,
    projection: Float32Array,
    view: Float32Array,
    distance: number,
  ) {
    if (!this.count) return;
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(this.uniforms.get('model')!, false, model);
    gl.uniformMatrix4fv(this.uniforms.get('projection')!, false, projection);
    gl.uniformMatrix4fv(this.uniforms.get('view')!, false, view);
    gl.uniform3f(this.uniforms.get('camera_position')!, 0, 0, distance);
    gl.uniform3f(this.uniforms.get('light_position')!, 2, 3, 4);
    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.count);
    gl.bindVertexArray(null);
  }

  dispose() {
    this.gl.deleteBuffer(this.geometry);
    this.gl.deleteBuffer(this.instances);
    this.gl.deleteVertexArray(this.vao);
    this.gl.deleteProgram(this.program);
  }
}

export class MoleculeRenderer {
  private spheres: Batch;
  private bonds: Batch;

  constructor(private gl: WebGL2RenderingContext) {
    this.spheres = new Batch(gl, sphereVertex, sphereFragment, [3, 4, 1]);
    this.bonds = new Batch(gl, bondVertex, bondFragment, [3, 3, 4, 4, 1]);
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0.067, 0.067, 0.067, 1);
  }

  setMolecule(molecule: Molecule) {
    this.spheres.update(
      new Float32Array(
        molecule.atoms.flatMap((a) => [...a.position, ...a.color, a.radius]),
      ),
      molecule.atoms.length,
    );
    this.bonds.update(
      new Float32Array(
        molecule.bonds.flatMap(([a, b]) => [
          ...a.position,
          ...b.position,
          ...a.color,
          ...b.color,
          molecule.bondRadius,
        ]),
      ),
      molecule.bonds.length,
    );
  }

  draw(width: number, height: number, rotation: Quaternion, distance: number) {
    const gl = this.gl;
    gl.viewport(0, 0, width, height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const model = rotationMatrix(rotation),
      projection = perspective(width / height, distance),
      view = viewMatrix(distance);
    this.spheres.draw(model, projection, view, distance);
    this.bonds.draw(model, projection, view, distance);
  }

  dispose() {
    this.spheres.dispose();
    this.bonds.dispose();
  }
}
