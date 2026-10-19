declare module "brewcalc/lib/brewcalc.js" {
  export function gravityPoints(
    fermentables: { type: string; potential: number; amount: number }[],
    efficiency: number,
    attenuation?: number,
  ): number;
  export function originalGravity(batchLiters: number, points: number): number;
  export function finalGravity(batchLiters: number, points: number): number;
  export function estABV(originalPoints: number, finalPoints: number): number;
  export function colorSRM(
    fermentables: { amount: number; color: number }[],
    volume: number,
  ): number;
  export function srmToCss(srm: number): string;
  export function bitternessIbuTinseth(
    hops: {
      amount: number;
      alpha: number;
      form: string;
      time: number;
      use: string;
    }[],
    averageGravity: number,
    volume: number,
  ): number;
}
