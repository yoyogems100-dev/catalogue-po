// Stable IDs from the existing YOYO catalogue; names may be edited without changing behavior.
export const RAINBOW_CATEGORY_ID = 29;
export const DRILLED_CATEGORY_ID = 20;
export function specialCategory(id:number) { return id===RAINBOW_CATEGORY_ID ? 'rainbow' : id===DRILLED_CATEGORY_ID ? 'drilled' : null; }
export type OrderSpecs = {kind:'rainbow'; colorMode:'default'|'custom'; stonesPerStrip:number; colors:{id:number;name:string}[]} | {kind:'drilled'; drill:'half'|'full'};
export function specText(spec?:OrderSpecs|null, quantity?:number):string {
 if(!spec) return '';
 if(spec.kind==='drilled') return spec.drill==='half'?'Half drill':'Full drill';
 return `${spec.colorMode==='default'?'Default colors':`Custom colors: ${spec.colors.map(c=>c.name).join(', ')}`} · ${quantity ? `${quantity/spec.stonesPerStrip} strips × ` : ''}${spec.stonesPerStrip} stones${quantity?'':' per strip'}`;
}
export function specKey(spec?:OrderSpecs|null) {return JSON.stringify(spec || null);}
export function validSpecQuantity(spec:OrderSpecs|null|undefined, qty:number) {return Number.isSafeInteger(qty) && qty>0 && qty<=2147483647 && (spec?.kind!=='rainbow' || (Number.isSafeInteger(spec.stonesPerStrip) && spec.stonesPerStrip>0 && qty%spec.stonesPerStrip===0));}

export function quantityFactor(spec?:OrderSpecs|null){return spec?.kind==='rainbow'?spec.stonesPerStrip:1;}
