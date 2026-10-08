// Stable IDs from the existing YOYO catalogue; names may be edited without changing behavior.
export const RAINBOW_CATEGORY_ID = 29;
export const DRILLED_CATEGORY_ID = 20;
export function specialCategory(id:number) { return id===RAINBOW_CATEGORY_ID ? 'rainbow' : id===DRILLED_CATEGORY_ID ? 'drilled' : null; }
// Hole Punched lines carry how many holes (1-3). Lines from before that carried
// half/full drill instead; they're still read, never written.
export type DrilledSpec = {kind:'drilled'; holes:1|2|3} | {kind:'drilled'; drill:'half'|'full'};
export function drilledHoles(spec?:OrderSpecs|null):1|2|3|null { return spec?.kind==='drilled' && 'holes' in spec ? spec.holes : null; }
export type OrderSpecs = {kind:'rainbow'; colorMode:'default'|'custom'; stonesPerStrip:number; colors:{id:number;name:string}[]} | DrilledSpec | {kind:'grade'; grade:string} | {kind:'carat'; pcsPerCt:number};

// Moissanite melee is ordered by whole carats: the line's qty stays in pieces,
// always a whole number of carats times the size's pieces-per-carat.
export function caratSpec(pcsPerCt: number): OrderSpecs { return { kind: 'carat', pcsPerCt }; }
/** Carats for a pieces count, rounded UP to a whole carat. */
export function caratsFor(pcs: number, pcsPerCt: number): number { return pcs > 0 ? Math.ceil(pcs / pcsPerCt) : 0; }

// Quality grades offered inside a category, chosen alongside colour/shape/size
// rather than as separate categories. (The CZ grades predate this and are
// their own categories -- 3A/4A/5A Quality CZ, 7A Quality.) Stored on the line
// as order_specs {kind:'grade', grade}. Ruby Corundum is category 2.
export const RUBY_CORUNDUM_CATEGORY_ID = 2;
export const CATEGORY_GRADES: Record<number, string[]> = { [RUBY_CORUNDUM_CATEGORY_ID]: ['5A', '7A'] };
export function categoryGrades(categoryId: number): string[] { return CATEGORY_GRADES[categoryId] || []; }
export function gradeSpec(grade: string): OrderSpecs { return { kind: 'grade', grade }; }
export function specText(spec?:OrderSpecs|null, quantity?:number):string {
 if(!spec) return '';
 if(spec.kind==='drilled') return 'holes' in spec ? (spec.holes===1?'1 hole':`${spec.holes} holes`) : spec.drill==='half'?'Half drill':'Full drill';
 if(spec.kind==='grade') return `Quality ${spec.grade}`;
 if(spec.kind==='carat') return quantity ? `${quantity/spec.pcsPerCt} ct (1ct = ~${spec.pcsPerCt} pcs)` : `1ct = ~${spec.pcsPerCt} pcs`;
 return `${spec.colorMode==='default'?'Default colors':`Custom colors: ${spec.colors.map(c=>c.name).join(', ')}`} · ${quantity ? `${quantity/spec.stonesPerStrip} strips × ` : ''}${spec.stonesPerStrip} stones${quantity?'':' per strip'}`;
}
export function specKey(spec?:OrderSpecs|null) {return JSON.stringify(spec || null);}
export function validSpecQuantity(spec:OrderSpecs|null|undefined, qty:number) {return Number.isSafeInteger(qty) && qty>0 && qty<=2147483647 && (spec?.kind!=='rainbow' || (Number.isSafeInteger(spec.stonesPerStrip) && spec.stonesPerStrip>0 && qty%spec.stonesPerStrip===0)) && (spec?.kind!=='carat' || (Number.isSafeInteger(spec.pcsPerCt) && spec.pcsPerCt>0 && qty%spec.pcsPerCt===0));}

export function quantityFactor(spec?:OrderSpecs|null){return spec?.kind==='rainbow'?spec.stonesPerStrip:spec?.kind==='carat'?spec.pcsPerCt:1;}
