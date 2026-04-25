// Picks a contact directly from the device's Contacts app when supported
// (Web Contact Picker API — Android Chrome). Returns parsed form values
// matching our import shape, or null if unsupported / cancelled.

export interface PickedContact {
  name: string;
  job_title: string;
  department: string;
  contact_name: string; // for vendor form
  category: string;     // for vendor form
  phone: string;
  email: string;
  website: string;
  address: string;
  notes: string;
}

interface ContactsManager {
  select: (
    properties: string[],
    options?: { multiple?: boolean }
  ) => Promise<Array<Record<string, unknown>>>;
  getProperties: () => Promise<string[]>;
}

interface NavigatorWithContacts extends Navigator {
  contacts?: ContactsManager;
}

export const isContactPickerSupported = (): boolean => {
  if (typeof navigator === "undefined") return false;
  if (typeof window !== "undefined") {
    try {
      if (window.self !== window.top) return false;
    } catch {
      return false;
    }
    if (!window.isSecureContext) return false;
  }
  const nav = navigator as NavigatorWithContacts;
  return Boolean(nav.contacts && typeof nav.contacts.select === "function");
};

export const getContactPickerUnavailableReason = (): string | null => {
  if (typeof navigator === "undefined") return "Contacts are not available in this browser.";
  if (typeof window !== "undefined") {
    try {
      if (window.self !== window.top) {
        return "The phone Contacts picker only opens when the app is opened directly, not inside the Lovable preview frame. Open the app in a published/full browser tab on Android Chrome, or import a .vcf contact file here.";
      }
    } catch {
      return "The phone Contacts picker cannot open from this embedded preview. Open the app directly, or import a .vcf contact file here.";
    }
    if (!window.isSecureContext) return "The phone Contacts picker requires a secure HTTPS page.";
  }
  const nav = navigator as NavigatorWithContacts;
  if (!nav.contacts || typeof nav.contacts.select !== "function") {
    return "This browser does not allow websites to open the phone Contacts app directly. Android Chrome supports it; iPhone and desktop require importing a shared .vcf contact file.";
  }
  return null;
};

const firstString = (val: unknown): string => {
  if (Array.isArray(val) && val.length > 0) {
    const v = val[0];
    if (typeof v === "string") return v;
    if (v && typeof v === "object") {
      // Address objects: use formatted-like join
      const obj = v as Record<string, unknown>;
      const parts = [
        obj.streetAddress,
        obj.addressLine,
        obj.city,
        obj.region,
        obj.postalCode,
        obj.country,
      ]
        .filter((p) => typeof p === "string" && (p as string).trim())
        .join(", ");
      return parts;
    }
  }
  if (typeof val === "string") return val;
  return "";
};

export interface PickContactsResult {
  contacts: PickedContact[];
  cancelled: boolean;
}

export const pickContactsFromDevice = async (
  multiple = true
): Promise<PickContactsResult> => {
  const nav = navigator as NavigatorWithContacts;
  if (!nav.contacts) return { contacts: [], cancelled: false };

  const supported = await nav.contacts.getProperties().catch(() => [] as string[]);
  const desired = ["name", "tel", "email", "address", "icon"].filter((p) =>
    supported.includes(p)
  );
  if (desired.length === 0) return { contacts: [], cancelled: false };

  let raw: Array<Record<string, unknown>>;
  try {
    raw = await nav.contacts.select(desired, { multiple });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { contacts: [], cancelled: true };
    }
    throw err;
  }
  if (!raw || raw.length === 0) {
    return { contacts: [], cancelled: true };
  }

  const contacts: PickedContact[] = raw.map((c) => {
    const name = firstString(c.name);
    const phone = firstString(c.tel);
    const email = firstString(c.email);
    const address = firstString(c.address);
    return {
      name,
      job_title: "",
      department: "",
      contact_name: "",
      category: "",
      phone,
      email,
      website: "",
      address,
      notes: "",
    };
  });

  return { contacts, cancelled: false };
};
