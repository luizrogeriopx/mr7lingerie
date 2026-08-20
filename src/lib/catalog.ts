import { supabase } from "@/integrations/supabase/client";

export type SiteSettings = {
  id: boolean;
  site_name: string;
  tagline: string | null;
  about: string | null;
  logo_url: string | null;
  whatsapp: string | null;
  email: string | null;
  instagram: string | null;
  address: string | null;
};

export type AttributeValue = {
  id: string;
  attribute_id: string;
  value: string;
  color_hex: string | null;
  sort_order: number;
};

export type Attribute = {
  id: string;
  name: string;
  sort_order: number;
  attribute_values: AttributeValue[];
};

export type ProductImage = {
  id: string;
  url: string;
  storage_path: string | null;
  sort_order: number;
};

export type Product = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  price: number;
  stock: number;
  category: string | null;
  is_active: boolean;
  is_featured: boolean;
  created_at: string;
  product_images: ProductImage[];
  product_attribute_values: { attribute_value_id: string }[];
};

const PRODUCT_SELECT =
  "id,title,slug,description,price,stock,category,is_active,is_featured,created_at,product_images(id,url,storage_path,sort_order),product_attribute_values(attribute_value_id)";

export function formatPrice(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value ?? 0));
}

export function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

export const siteSettingsQuery = {
  queryKey: ["site-settings"],
  queryFn: async (): Promise<SiteSettings> => {
    const { data, error } = await supabase.from("site_settings").select("*").limit(1).maybeSingle();
    if (error) throw error;
    return (data ?? {
      id: true,
      site_name: "Meu Catálogo",
      tagline: null,
      about: null,
      logo_url: null,
      whatsapp: null,
      email: null,
      instagram: null,
      address: null,
    }) as SiteSettings;
  },
};

export const attributesQuery = {
  queryKey: ["attributes"],
  queryFn: async (): Promise<Attribute[]> => {
    const { data, error } = await supabase
      .from("attributes")
      .select("id,name,sort_order,attribute_values(id,attribute_id,value,color_hex,sort_order)")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as unknown as Attribute[]).map((a) => ({
      ...a,
      attribute_values: [...(a.attribute_values ?? [])].sort(
        (x, y) => x.sort_order - y.sort_order || x.value.localeCompare(y.value),
      ),
    }));
  },
};

export const productsQuery = (opts?: { includeInactive?: boolean }) => ({
  queryKey: ["products", opts?.includeInactive ? "all" : "active"],
  queryFn: async (): Promise<Product[]> => {
    let query = supabase.from("products").select(PRODUCT_SELECT);
    if (!opts?.includeInactive) query = query.eq("is_active", true);
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as Product[];
  },
});

export const productBySlugQuery = (slug: string) => ({
  queryKey: ["product", slug],
  queryFn: async (): Promise<Product | null> => {
    const { data, error } = await supabase
      .from("products")
      .select(PRODUCT_SELECT)
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw error;
    return (data ?? null) as unknown as Product | null;
  },
});

export const productByIdQuery = (id: string) => ({
  queryKey: ["product-id", id],
  queryFn: async (): Promise<Product | null> => {
    const { data, error } = await supabase
      .from("products")
      .select(PRODUCT_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data ?? null) as unknown as Product | null;
  },
});

const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

export async function uploadCatalogImage(file: File, folder: string) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("catalog").upload(path, file, {
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw error;
  const { data, error: signError } = await supabase.storage
    .from("catalog")
    .createSignedUrl(path, TEN_YEARS);
  if (signError) throw signError;
  return { path, url: data.signedUrl };
}

export async function removeCatalogImage(path: string | null) {
  if (!path) return;
  await supabase.storage.from("catalog").remove([path]);
}

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  title: string;
  options: string | null;
  unit_price: number;
  quantity: number;
};

export type Order = {
  id: string;
  customer_name: string;
  customer_phone: string;
  note: string | null;
  total: number;
  status: string;
  created_at: string;
  order_items: OrderItem[];
};

export const ordersQuery = {
  queryKey: ["orders"],
  queryFn: async (): Promise<Order[]> => {
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id,customer_name,customer_phone,note,total,status,created_at,order_items(id,order_id,product_id,title,options,unit_price,quantity)",
      )
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as Order[];
  },
};

export function sortedImages(product: Pick<Product, "product_images">) {
  return [...(product.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order);
}

export function cleanPhone(phone: string) {
  return phone.replace(/\D/g, "");
}

export function formatWhatsappUrl(phone: string, text: string) {
  const digits = cleanPhone(phone);
  // If no country code and has 10 or 11 digits (Brazil DDD + number), prepend 55
  const fullPhone = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
  return `https://api.whatsapp.com/send?phone=${fullPhone}&text=${encodeURIComponent(text)}`;
}
