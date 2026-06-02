// Normalize an Israeli phone number to E.164 (+972...) for Firebase MFA.
// "0528322838" -> "+972528322838", "+97252..." stays, "97252..." -> "+97252..."
export function toE164Israel(phone: string): string {
  let p = (phone || "").replace(/[^\d+]/g, "");
  if (!p) return "";
  if (p.startsWith("+")) return p;
  if (p.startsWith("00")) return "+" + p.slice(2);
  if (p.startsWith("972")) return "+" + p;
  if (p.startsWith("0")) return "+972" + p.slice(1);
  return "+972" + p;
}
