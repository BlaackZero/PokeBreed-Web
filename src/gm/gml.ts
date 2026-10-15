// Compilador de GML (Game Maker 5) a funciones JavaScript.
//
// Semántica de GM5 que se respeta:
//  - `=` dentro de una expresión es comparación; como sentencia es asignación.
//  - las comparaciones y operadores lógicos devuelven 1 / 0.
//  - un valor es "verdadero" si es >= 0.5.
//  - `var` declara variables locales al trozo de código.
//  - nombre[0] es lo mismo que nombre; las variables sin índice son el elemento 0.
//  - los nombres de recursos (objetos, sprites, sonidos...) son constantes.

export type Compiled = (rt: any, self: any, other: any, args: any[]) => any;

type Tok =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'id'; v: string }
  | { t: 'op'; v: string }
  | { t: 'eof' };

const KEYWORDS = new Set(['if', 'else', 'then', 'while', 'do', 'until', 'for', 'repeat', 'with', 'exit', 'return', 'break', 'continue', 'var', 'globalvar', 'begin', 'end', 'switch', 'case', 'default', 'not', 'and', 'or', 'xor', 'div', 'mod']);
const OPS = [':=', '==', '!=', '<>', '<=', '>=', '&&', '||', '^^', '+=', '-=', '*=', '/=', '|=', '&=', '^=', '<<', '>>', '++', '--',
  '=', '<', '>', '+', '-', '*', '/', '%', '|', '&', '^', '!', '~', '(', ')', '[', ']', '{', '}', ',', ';', '.', ':'];

function lex(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\r' || c === '\n') { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 2; continue; }
    if (c === '"' || c === "'") {
      const e = src.indexOf(c, i + 1);
      const end = e < 0 ? src.length : e;
      out.push({ t: 'str', v: src.slice(i + 1, end) });
      i = end + 1;
      continue;
    }
    if (c === '$' && /[0-9a-fA-F]/.test(src[i + 1] ?? '')) {
      let j = i + 1;
      while (j < src.length && /[0-9a-fA-F]/.test(src[j])) j++;
      out.push({ t: 'num', v: parseInt(src.slice(i + 1, j), 16) });
      i = j;
      continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      out.push({ t: 'num', v: parseFloat(src.slice(i, j)) });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      out.push({ t: 'id', v: src.slice(i, j) });
      i = j;
      continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (!op) throw new Error(`Carácter inesperado '${c}'`);
    out.push({ t: 'op', v: op });
    i += op.length;
  }
  out.push({ t: 'eof' });
  return out;
}

// ---------- AST ----------
type Expr =
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 'name'; v: string }
  | { k: 'index'; name: string; idx: Expr[] }
  | { k: 'dot'; obj: Expr; name: string; idx?: Expr[] }
  | { k: 'call'; name: string; args: Expr[] }
  | { k: 'un'; op: string; e: Expr }
  | { k: 'bin'; op: string; a: Expr; b: Expr };

type Stmt =
  | { k: 'block'; body: Stmt[] }
  | { k: 'var'; names: string[] }
  | { k: 'assign'; target: Expr; op: string; value: Expr }
  | { k: 'expr'; e: Expr }
  | { k: 'if'; cond: Expr; then: Stmt; else?: Stmt }
  | { k: 'while'; cond: Expr; body: Stmt }
  | { k: 'do'; body: Stmt; cond: Expr }
  | { k: 'for'; init: Stmt; cond: Expr; step: Stmt; body: Stmt }
  | { k: 'repeat'; n: Expr; body: Stmt }
  | { k: 'with'; target: Expr; body: Stmt }
  | { k: 'exit' }
  | { k: 'return'; e?: Expr }
  | { k: 'break' }
  | { k: 'continue' }
  | { k: 'empty' };

class Parser {
  private p = 0;
  readonly locals = new Set<string>();
  constructor(private toks: Tok[]) {}

  private peek(o = 0) { return this.toks[this.p + o]; }
  private next() { return this.toks[this.p++]; }
  private isOp(v: string, o = 0) { const t = this.peek(o); return t.t === 'op' && t.v === v; }
  private isId(v: string, o = 0) { const t = this.peek(o); return t.t === 'id' && t.v === v; }
  private eat(v: string) { if (this.isOp(v)) { this.p++; return true; } return false; }
  private expect(v: string) {
    if (!this.eat(v)) throw new Error(`Se esperaba '${v}' y llegó ${JSON.stringify(this.peek())}`);
  }

  program(): Stmt {
    const body: Stmt[] = [];
    while (this.peek().t !== 'eof') body.push(this.stmt());
    return { k: 'block', body };
  }

  private stmt(): Stmt {
    const t = this.peek();
    if (t.t === 'op') {
      if (t.v === ';') { this.p++; return { k: 'empty' }; }
      if (t.v === '{') return this.block('}');
    }
    if (t.t === 'id') {
      switch (t.v) {
        case 'begin': this.p++; return this.block('end');
        case 'var': case 'globalvar': {
          this.p++;
          const names: string[] = [];
          do {
            const n = this.next();
            if (n.t !== 'id') throw new Error('Nombre de variable esperado tras var');
            names.push(n.v);
            if (t.v === 'var') this.locals.add(n.v);
          } while (this.eat(','));
          this.eat(';');
          return t.v === 'var' ? { k: 'var', names } : { k: 'empty' };
        }
        case 'if': {
          this.p++;
          const cond = this.expr();
          if (this.isId('then')) this.p++;
          const then = this.stmt();
          this.eat(';');
          if (this.isId('else')) { this.p++; return { k: 'if', cond, then, else: this.stmt() }; }
          return { k: 'if', cond, then };
        }
        case 'while': {
          this.p++;
          const cond = this.expr();
          if (this.isId('do')) this.p++;
          return { k: 'while', cond, body: this.stmt() };
        }
        case 'do': {
          this.p++;
          const body = this.stmt();
          if (!this.isId('until')) throw new Error("Se esperaba 'until'");
          this.p++;
          const cond = this.expr();
          this.eat(';');
          return { k: 'do', body, cond };
        }
        case 'for': {
          this.p++;
          this.expect('(');
          const init = this.stmt();
          const cond = this.expr();
          this.eat(';');
          const step = this.simple();
          this.expect(')');
          return { k: 'for', init, cond, step, body: this.stmt() };
        }
        case 'repeat': { this.p++; const n = this.expr(); return { k: 'repeat', n, body: this.stmt() }; }
        case 'with': { this.p++; const target = this.expr(); if (this.isId('do')) this.p++; return { k: 'with', target, body: this.stmt() }; }
        case 'exit': this.p++; this.eat(';'); return { k: 'exit' };
        case 'break': this.p++; this.eat(';'); return { k: 'break' };
        case 'continue': this.p++; this.eat(';'); return { k: 'continue' };
        case 'return': {
          this.p++;
          if (this.isOp(';') || this.isOp('}') || this.peek().t === 'eof') { this.eat(';'); return { k: 'return' }; }
          const e = this.expr();
          this.eat(';');
          return { k: 'return', e };
        }
      }
    }
    const s = this.simple();
    this.eat(';');
    return s;
  }

  private block(close: string): Stmt {
    this.p++;
    const body: Stmt[] = [];
    while (!(close === '}' ? this.isOp('}') : this.isId('end'))) {
      if (this.peek().t === 'eof') throw new Error(`Falta '${close}'`);
      body.push(this.stmt());
    }
    this.p++;
    return { k: 'block', body };
  }

  /** Asignación o llamada. */
  private simple(): Stmt {
    const e = this.postfix();
    const t = this.peek();
    if (t.t === 'op' && ['=', ':=', '+=', '-=', '*=', '/=', '|=', '&=', '^='].includes(t.v)) {
      this.p++;
      const value = this.expr();
      return { k: 'assign', target: e, op: t.v === ':=' ? '=' : t.v, value };
    }
    if (t.t === 'op' && (t.v === '++' || t.v === '--')) {
      this.p++;
      return { k: 'assign', target: e, op: t.v === '++' ? '+=' : '-=', value: { k: 'num', v: 1 } };
    }
    return { k: 'expr', e };
  }

  expr(): Expr { return this.or(); }

  private or(): Expr {
    let a = this.and();
    for (;;) {
      if (this.isOp('||') || this.isId('or')) { this.p++; a = { k: 'bin', op: '||', a, b: this.and() }; }
      else if (this.isOp('^^') || this.isId('xor')) { this.p++; a = { k: 'bin', op: '^^', a, b: this.and() }; }
      else return a;
    }
  }

  private and(): Expr {
    let a = this.cmp();
    while (this.isOp('&&') || this.isId('and')) { this.p++; a = { k: 'bin', op: '&&', a, b: this.cmp() }; }
    return a;
  }

  private cmp(): Expr {
    let a = this.bit();
    for (;;) {
      const t = this.peek();
      if (t.t === 'op' && ['==', '=', '!=', '<>', '<', '<=', '>', '>='].includes(t.v)) {
        this.p++;
        const op = t.v === '=' ? '==' : t.v === '<>' ? '!=' : t.v;
        a = { k: 'bin', op, a, b: this.bit() };
      } else return a;
    }
  }

  private bit(): Expr {
    let a = this.shift();
    for (;;) {
      const t = this.peek();
      if (t.t === 'op' && (t.v === '|' || t.v === '&' || t.v === '^')) { this.p++; a = { k: 'bin', op: t.v, a, b: this.shift() }; }
      else return a;
    }
  }

  private shift(): Expr {
    let a = this.add();
    for (;;) {
      const t = this.peek();
      if (t.t === 'op' && (t.v === '<<' || t.v === '>>')) { this.p++; a = { k: 'bin', op: t.v, a, b: this.add() }; }
      else return a;
    }
  }

  private add(): Expr {
    let a = this.mul();
    for (;;) {
      const t = this.peek();
      if (t.t === 'op' && (t.v === '+' || t.v === '-')) { this.p++; a = { k: 'bin', op: t.v, a, b: this.mul() }; }
      else return a;
    }
  }

  private mul(): Expr {
    let a = this.unary();
    for (;;) {
      const t = this.peek();
      if (t.t === 'op' && (t.v === '*' || t.v === '/' || t.v === '%')) { this.p++; a = { k: 'bin', op: t.v === '%' ? 'mod' : t.v, a, b: this.unary() }; }
      else if (t.t === 'id' && (t.v === 'div' || t.v === 'mod')) { this.p++; a = { k: 'bin', op: t.v, a, b: this.unary() }; }
      else return a;
    }
  }

  private unary(): Expr {
    const t = this.peek();
    if (t.t === 'op' && (t.v === '-' || t.v === '+' || t.v === '!' || t.v === '~')) { this.p++; return { k: 'un', op: t.v, e: this.unary() }; }
    if (t.t === 'id' && t.v === 'not') { this.p++; return { k: 'un', op: '!', e: this.unary() }; }
    return this.postfix();
  }

  private postfix(): Expr {
    let e = this.primary();
    for (;;) {
      if (this.isOp('.')) {
        this.p++;
        const n = this.next();
        if (n.t !== 'id') throw new Error('Nombre esperado tras "."');
        let idx: Expr[] | undefined;
        if (this.isOp('[')) idx = this.indices();
        e = { k: 'dot', obj: e, name: n.v, idx };
      } else return e;
    }
  }

  private indices(): Expr[] {
    this.expect('[');
    const idx = [this.expr()];
    while (this.eat(',')) idx.push(this.expr());
    this.expect(']');
    return idx;
  }

  private primary(): Expr {
    const t = this.next();
    if (t.t === 'num') return { k: 'num', v: t.v };
    if (t.t === 'str') return { k: 'str', v: t.v };
    if (t.t === 'op' && t.v === '(') { const e = this.expr(); this.expect(')'); return e; }
    if (t.t === 'id' && !KEYWORDS.has(t.v)) {
      if (this.isOp('(')) {
        this.p++;
        const args: Expr[] = [];
        if (!this.isOp(')')) { do args.push(this.expr()); while (this.eat(',')); }
        this.expect(')');
        return { k: 'call', name: t.v, args };
      }
      if (this.isOp('[')) return { k: 'index', name: t.v, idx: this.indices() };
      return { k: 'name', v: t.v };
    }
    throw new Error(`Token inesperado ${JSON.stringify(t)}`);
  }
}

// ---------- Generación de código ----------

/** Lo que el compilador necesita saber del juego. */
export interface CompileEnv {
  /** Constantes: recursos y constantes de GM (c_white, vk_left...). */
  constants: Map<string, number>;
  /** Variables de instancia integradas (x, y, speed...). */
  instanceBuiltins: Set<string>;
  /** Variables globales integradas (room, mouse_x, view_left...). */
  globalBuiltins: Set<string>;
  /** Funciones integradas disponibles en rt.F. */
  functions: Set<string>;
  /** Scripts: nombre → índice. */
  scripts: Map<string, number>;
  /** Funciones llamadas que no existen (para diagnóstico). */
  unknown?: Set<string>;
}

const js = JSON.stringify;

class Gen {
  private tmp = 0;
  constructor(private env: CompileEnv, private locals: Set<string>) {}

  private local(n: string) { return `L_${n}`; }

  expr(e: Expr): string {
    switch (e.k) {
      case 'num': return String(e.v);
      case 'str': return js(e.v);
      case 'name': return this.readName(e.v);
      case 'index': return this.readIndexed(e.name, e.idx);
      case 'dot': return this.readDot(e);
      case 'call': return this.call(e.name, e.args);
      case 'un':
        if (e.op === '-') return `(-${this.expr(e.e)})`;
        if (e.op === '+') return `(+${this.expr(e.e)})`;
        if (e.op === '!') return `(rt.t(${this.expr(e.e)})?0:1)`;
        return `(~Math.round(${this.expr(e.e)}))`;
      case 'bin': {
        const a = this.expr(e.a);
        const b = this.expr(e.b);
        switch (e.op) {
          case '&&': return `(rt.t(${a})&&rt.t(${b})?1:0)`;
          case '||': return `(rt.t(${a})||rt.t(${b})?1:0)`;
          case '^^': return `(rt.t(${a})!==rt.t(${b})?1:0)`;
          case '==': return `(rt.eq(${a},${b})?1:0)`;
          case '!=': return `(rt.eq(${a},${b})?0:1)`;
          case '<': case '<=': case '>': case '>=': return `((${a})${e.op}(${b})?1:0)`;
          case '|': case '&': case '^': case '<<': case '>>': return `(Math.round(${a})${e.op}Math.round(${b}))`;
          case 'div': return `Math.trunc((${a})/(${b}))`;
          case 'mod': return `((${a})%(${b}))`;
          case '+': return `rt.add(${a},${b})`;
          default: return `((${a})${e.op}(${b}))`;
        }
      }
    }
  }

  private readName(n: string): string {
    if (this.locals.has(n)) return this.local(n);
    if (n === 'self') return '-1';
    if (n === 'other') return '-2';
    if (n === 'all') return '-3';
    if (n === 'noone') return '-4';
    if (n === 'global') return '-5';
    if (/^argument[0-9]$/.test(n)) return `(args[${n.slice(8)}]??0)`;
    if (this.env.constants.has(n)) return String(this.env.constants.get(n));
    if (this.env.instanceBuiltins.has(n)) return `self.b(${js(n)})`;
    if (this.env.globalBuiltins.has(n)) return `rt.gb(${js(n)},0)`;
    return `rt.rv(self,${js(n)})`;
  }

  private readIndexed(n: string, idx: Expr[]): string {
    const i = this.index(idx);
    if (n === 'argument') return `(args[${i}]??0)`;
    if (this.locals.has(n)) return this.local(n);
    if (this.env.instanceBuiltins.has(n)) return `self.ba(${js(n)},${i})`;
    if (this.env.globalBuiltins.has(n)) return `rt.gb(${js(n)},${i})`;
    return `rt.rva(self,${js(n)},${i})`;
  }

  private index(idx: Expr[]) {
    return idx.length === 1 ? this.expr(idx[0]) : `(${this.expr(idx[0])})*32000+(${this.expr(idx[1])})`;
  }

  private readDot(e: Extract<Expr, { k: 'dot' }>): string {
    const i = e.idx ? this.index(e.idx) : '0';
    if (e.obj.k === 'name' && e.obj.v === 'global' && !this.locals.has('global')) {
      return e.idx ? `rt.gva(${js(e.name)},${i})` : `rt.gv(${js(e.name)})`;
    }
    return `rt.dotGet(self,other,${this.expr(e.obj)},${js(e.name)},${i})`;
  }

  private call(name: string, args: Expr[]): string {
    const a = args.map((x) => this.expr(x));
    if (this.env.scripts.has(name)) return `rt.script(${this.env.scripts.get(name)},self,other,[${a.join(',')}])`;
    if (this.env.functions.has(name)) return `rt.F.${name}(self,other${a.map((x) => `,${x}`).join('')})`;
    this.env.unknown?.add(name);
    return `rt.unknownFn(${js(name)})`;
  }

  /** Código JS que asigna `value` (código JS) al destino. */
  assign(target: Expr, op: string, value: string): string {
    const compound = op !== '=';
    const bop = op.slice(0, 1);
    const combine = (cur: string) => {
      if (!compound) return value;
      if (bop === '+') return `rt.add(${cur},${value})`;
      if (bop === '|' || bop === '&' || bop === '^') return `(Math.round(${cur})${bop}Math.round(${value}))`;
      return `((${cur})${bop}(${value}))`;
    };
    switch (target.k) {
      case 'name': {
        const n = target.v;
        if (this.locals.has(n)) return `${this.local(n)}=${combine(this.local(n))};`;
        if (this.env.instanceBuiltins.has(n)) return `self.sb(${js(n)},${combine(`self.b(${js(n)})`)});`;
        if (this.env.globalBuiltins.has(n)) return `rt.sgb(${js(n)},0,${combine(`rt.gb(${js(n)},0)`)});`;
        return `rt.sv(self,${js(n)},${combine(`rt.rv(self,${js(n)})`)});`;
      }
      case 'index': {
        const n = target.name;
        const v = `_i${this.tmp++}`;
        const pre = `const ${v}=${this.index(target.idx)};`;
        if (this.locals.has(n)) return `${this.local(n)}=${combine(this.local(n))};`;
        if (this.env.instanceBuiltins.has(n)) return `{${pre}self.sba(${js(n)},${v},${combine(`self.ba(${js(n)},${v})`)});}`;
        if (this.env.globalBuiltins.has(n)) return `{${pre}rt.sgb(${js(n)},${v},${combine(`rt.gb(${js(n)},${v})`)});}`;
        return `{${pre}rt.sva(self,${js(n)},${v},${combine(`rt.rva(self,${js(n)},${v})`)});}`;
      }
      case 'dot': {
        const i = target.idx ? this.index(target.idx) : '0';
        if (target.obj.k === 'name' && target.obj.v === 'global' && !this.locals.has('global')) {
          return `rt.sgva(${js(target.name)},${i},${combine(`rt.gva(${js(target.name)},${i})`)});`;
        }
        const o = `_o${this.tmp++}`;
        const ii = `_i${this.tmp++}`;
        return `{const ${o}=${this.expr(target.obj)},${ii}=${i};rt.dotSet(self,other,${o},${js(target.name)},${ii},(cur)=>${combine('cur')});}`;
      }
      default:
        throw new Error('No se puede asignar a esta expresión');
    }
  }

  stmt(s: Stmt): string {
    switch (s.k) {
      case 'block': return `{${s.body.map((b) => this.stmt(b)).join('')}}`;
      case 'empty': case 'var': return '';
      case 'assign': return this.assign(s.target, s.op, this.expr(s.value));
      case 'expr': return `${this.expr(s.e)};`;
      case 'if': return `if(rt.t(${this.expr(s.cond)}))${this.stmt(s.then)}${s.else ? `else ${this.stmt(s.else)}` : ''}`;
      case 'while': return `while(rt.t(${this.expr(s.cond)})){rt.loopGuard();${this.stmt(s.body)}}`;
      case 'do': return `do{rt.loopGuard();${this.stmt(s.body)}}while(!rt.t(${this.expr(s.cond)}));`;
      case 'for': return `{${this.stmt(s.init)}while(rt.t(${this.expr(s.cond)})){rt.loopGuard();${this.stmt(s.body)}${this.stmt(s.step)}}}`;
      case 'repeat': { const v = `_r${this.tmp++}`; return `for(let ${v}=Math.round(${this.expr(s.n)});${v}>0;${v}--)${this.stmt(s.body)}`; }
      case 'with': return `rt.withDo(self,other,${this.expr(s.target)},(self,other)=>{${this.stmt(s.body)}});`;
      case 'exit': return 'rt.exit();';
      case 'return': return `rt.ret(${s.e ? this.expr(s.e) : '0'});`;
      case 'break': return 'break;';
      case 'continue': return 'continue;';
    }
  }

  header() {
    return this.locals.size ? `let ${[...this.locals].map((n) => `${this.local(n)}=0`).join(',')};` : '';
  }
}

export class GmlError extends Error {}

/** Compila un trozo de GML (sentencias). */
export function compileCode(src: string, env: CompileEnv, label: string): Compiled {
  try {
    const p = new Parser(lex(src));
    const ast = p.program();
    const g = new Gen(env, p.locals);
    const body = g.stmt(ast);
    return new Function('rt', 'self', 'other', 'args', `${g.header()}${body}`) as Compiled;
  } catch (e) {
    throw new GmlError(`${label}: ${(e as Error).message}`);
  }
}

/** Compila una expresión GML y devuelve su código JS (para incrustar en acciones). */
export function exprToJs(src: string, env: CompileEnv, locals = new Set<string>()): string {
  const p = new Parser(lex(src));
  const e = p.expr();
  return new Gen(env, locals).expr(e);
}

/** Código JS que asigna a una variable dada por nombre (acción "Set variable"). */
export function assignToJs(target: string, op: string, valueJs: string, env: CompileEnv): string {
  const p = new Parser(lex(target));
  const e = p.expr();
  return new Gen(env, new Set()).assign(e, op, valueJs);
}

/** Envuelve código ya generado en una función. */
export function makeFn(body: string, label: string): Compiled {
  try {
    return new Function('rt', 'self', 'other', 'args', body) as Compiled;
  } catch (e) {
    throw new GmlError(`${label}: ${(e as Error).message}\n${body.slice(0, 500)}`);
  }
}
