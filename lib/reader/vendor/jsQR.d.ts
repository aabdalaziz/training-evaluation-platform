// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P82 */ /** تعريف أنواع مختصر لـ jsQR المُضمَّن. */
export type JsQrPoint = { x: number; y: number };
export type JsQrResult = { data: string; binaryData: number[]; location: { topLeftCorner: JsQrPoint; topRightCorner: JsQrPoint; bottomLeftCorner: JsQrPoint; bottomRightCorner: JsQrPoint } };
export type JsQrOptions = { inversionAttempts?: 'dontInvert' | 'onlyInvert' | 'attemptBoth' | 'invertFirst' };
declare function jsQR(data: Uint8ClampedArray, width: number, height: number, options?: JsQrOptions): JsQrResult | null;
export default jsQR;
