// Convierte las listas de acciones "drag & drop" de Game Maker 5 en código JavaScript.
import { compileCode, exprToJs, assignToJs, type CompileEnv, type Compiled } from './gml';
import type { ActionData } from './types';

const KIND = { NORMAL: 0, BEGIN: 1, END: 2, ELSE: 3, EXIT: 4, REPEAT: 5, VARIABLE: 6, CODE: 7 };

/** Trozos de código compilados aparte (acciones de código y plantillas de librerías). */
export class CodeTable {
  fns: Compiled[] = [];
  private byKey = new Map<string, number>();

  add(key: string, make: () => Compiled) {
    let i = this.byKey.get(key);
    if (i === undefined) {
      i = this.fns.length;
      this.fns.push(make());
      this.byKey.set(key, i);
    }
    return i;
  }
}

const js = JSON.stringify;

/** Argumento de acción según su tipo (ver LateralGM: Argument.ARG_*). */
function argJs(kind: number, raw: string, env: CompileEnv, label: string): string {
  try {
    switch (kind) {
      case 0: return exprToJs(raw, env);
      case 1: return js(raw);
      case 2: return /^\s*["']/.test(raw) ? exprToJs(raw, env) : js(raw);
      case 15: return `[${splitFont(raw).join(',')}]`;
      default: return String(Number(raw) || 0);
    }
  } catch (e) {
    throw new Error(`${label}: argumento ${js(raw)}: ${(e as Error).message}`);
  }
}

/** "Times New Roman",10,0,0,0,0,0 → ['"Times New Roman"', '10', ...] */
function splitFont(raw: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = '';
  for (const c of raw) {
    if (q) { cur += c; if (c === q) q = ''; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if (c === ',') { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  out.push(cur);
  return out.map((s) => {
    const t = s.trim();
    return /^["']/.test(t) ? js(t.slice(1, -1)) : String(Number(t) || 0);
  });
}

/** Sustituye el código de una acción de librería (lib#id) en un tipo de evento. */
export type TemplateOverride = (lib: number, id: number, eventType: number) => string | undefined;

export function compileActions(actions: ActionData[], env: CompileEnv, codes: CodeTable, label: string, eventType = -1, override?: TemplateOverride): string {
  let i = 0;

  const wrapApplies = (a: ActionData, body: string) => {
    if (a.appliesTo === -1) return body;
    return `rt.applyTo(self,other,${a.appliesTo},(self,other)=>{${body}});`;
  };

  const condition = (a: ActionData): string => {
    let c: string;
    if (a.execType === 2) {
      c = `rt.t(${templateCall(a)})`;
    } else {
      c = `rt.t(${callJs(a)})`;
    }
    if (a.appliesTo !== -1) c = `rt.applyQ(self,other,${a.appliesTo},(self,other)=>${c})`;
    return a.not ? `!(${c})` : c;
  };

  const templateCall = (a: ActionData) => {
    const code = override?.(a.lib, a.id, eventType) ?? a.code ?? '';
    const idx = codes.add(`tpl:${a.lib}:${a.id}:${code}`, () => compileCode(code, env, `${label} (acción ${a.lib}#${a.id})`));
    const args = a.args.map((v, k) => argJs(a.argKinds[k], v, env, label));
    return `rt.runCode(${idx},self,other,[${args.join(',')}])`;
  };

  const callJs = (a: ActionData) => {
    const args = a.args.map((v, k) => argJs(a.argKinds[k], v, env, label));
    const fn = a.fn ?? '';
    if (fn === 'action_inherited') return 'rt.inherited(self,other)';
    if (fn === 'action_execute_script') return `rt.script(${args[0]},self,other,[${args.slice(1).join(',')}])`;
    return `rt.A.${fn}(self,other,${a.relative ? 1 : 0}${args.map((x) => `,${x}`).join('')})`;
  };

  const stmt = (): string => {
    const a = actions[i++];
    if (!a) return '';
    switch (a.kind) {
      case KIND.BEGIN: {
        let body = '';
        while (i < actions.length && actions[i].kind !== KIND.END) body += stmt();
        i++;
        return `{${body}}`;
      }
      case KIND.END: return '';
      case KIND.ELSE: return '';
      case KIND.EXIT: return 'rt.exit();';
      case KIND.REPEAT: {
        const n = argJs(0, a.args[0] ?? '0', env, label);
        const v = `_rep${i}`;
        return `for(let ${v}=Math.round(${n});${v}>0;${v}--)${stmt() || ';'}`;
      }
      case KIND.VARIABLE: {
        const value = argJs(0, a.args[1] ?? '0', env, label);
        let code: string;
        try {
          code = assignToJs(a.args[0], a.relative ? '+=' : '=', value, env);
        } catch (e) {
          throw new Error(`${label}: variable ${js(a.args[0])}: ${(e as Error).message}`);
        }
        return wrapApplies(a, code);
      }
      case KIND.CODE: {
        const idx = codes.add(`code:${a.args[0]}`, () => compileCode(a.args[0] ?? '', env, `${label} (código)`));
        return wrapApplies(a, `rt.runCode(${idx},self,other,[]);`);
      }
      default: {
        if (a.question) {
          const cond = condition(a);
          const then = stmt() || ';';
          if (actions[i]?.kind === KIND.ELSE) {
            i++;
            return `if(${cond})${then}else ${stmt() || ';'}`;
          }
          return `if(${cond})${then}`;
        }
        if (a.execType === 2) return wrapApplies(a, `${templateCall(a)};`);
        if (a.execType === 1 && a.fn) return wrapApplies(a, `${callJs(a)};`);
        return ''; // comentarios y acciones vacías
      }
    }
  };

  let body = '';
  while (i < actions.length) body += stmt();
  return body;
}
