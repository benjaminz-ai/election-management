export function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function formatAddress(address: {
  street: string;
  streetNumber: string;
  building: string;
  apartment: string;
  city: string;
}): string {
  const parts = [address.street, address.streetNumber];
  if (address.building) parts.push(`בניין ${address.building}`);
  if (address.apartment) parts.push(`דירה ${address.apartment}`);
  parts.push(address.city);
  return parts.join(", ");
}
