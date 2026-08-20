import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Edit,
  Image as ImageIcon,
  Package,
  Layers,
  Settings,
  ShoppingBag,
  Upload,
  ExternalLink,
  LogOut,
  Search,
  Check,
  AlertCircle,
  Eye,
  MessageCircle,
} from "lucide-react";

import {
  attributesQuery,
  formatPrice,
  productsQuery,
  siteSettingsQuery,
  ordersQuery,
  slugify,
  uploadCatalogImage,
  removeCatalogImage,
  formatWhatsappUrl,
  type Product,
  type Attribute,
  type SiteSettings,
  type Order,
} from "@/lib/catalog";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Painel de Controle — Catálogo Virtual" },
      {
        name: "description",
        content: "Gerenciamento de produtos, atributos e configurações da loja.",
      },
    ],
  }),
  component: AdminPage,
});

/* =========================================================================
 * SUB-COMPONENTE: GESTÃO DE PRODUTOS
 * ========================================================================= */
function ProductsTab({
  products,
  attributes,
  onRefresh,
}: {
  products: Product[];
  attributes: Attribute[];
  onRefresh: () => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  // Form State
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [customSlug, setCustomSlug] = useState(false);
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("0");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  const [images, setImages] = useState<
    { id?: string; url: string; storage_path?: string | null; sort_order: number }[]
  >([]);
  const [selectedAttributeValues, setSelectedAttributeValues] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category).filter(Boolean) as string[])).sort(),
    [products],
  );

  const filteredProducts = useMemo(() => {
    const s = search.toLowerCase().trim();
    return products.filter((p) => {
      const matchSearch =
        !s || p.title.toLowerCase().includes(s) || (p.category ?? "").toLowerCase().includes(s);
      const matchCat = selectedCategory === "all" || p.category === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [products, search, selectedCategory]);

  const openCreateDialog = () => {
    setEditingProduct(null);
    setTitle("");
    setSlug("");
    setCustomSlug(false);
    setCategory("");
    setPrice("");
    setStock("1");
    setDescription("");
    setIsActive(true);
    setIsFeatured(false);
    setImages([]);
    setSelectedAttributeValues(new Set());
    setIsDialogOpen(true);
  };

  const openEditDialog = (p: Product) => {
    setEditingProduct(p);
    setTitle(p.title);
    setSlug(p.slug);
    setCustomSlug(true);
    setCategory(p.category ?? "");
    setPrice(String(p.price));
    setStock(String(p.stock));
    setDescription(p.description ?? "");
    setIsActive(p.is_active);
    setIsFeatured(p.is_featured);
    setImages([...p.product_images].sort((a, b) => a.sort_order - b.sort_order));
    setSelectedAttributeValues(
      new Set(p.product_attribute_values.map((v) => v.attribute_value_id)),
    );
    setIsDialogOpen(true);
  };

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!customSlug) {
      setSlug(slugify(val));
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingImage(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const { url, path } = await uploadCatalogImage(file, "products");
        setImages((prev) => [...prev, { url, storage_path: path, sort_order: prev.length }]);
      }
      toast.success("Foto(s) enviada(s) com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao fazer upload da imagem.");
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

  const removeImage = async (index: number) => {
    const img = images[index];
    if (img.storage_path) {
      try {
        await removeCatalogImage(img.storage_path);
      } catch (e) {
        console.error(e);
      }
    }
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleAttributeValue = (valId: string) => {
    setSelectedAttributeValues((prev) => {
      const next = new Set(prev);
      if (next.has(valId)) {
        next.delete(valId);
      } else {
        next.add(valId);
      }
      return next;
    });
  };

  const handleSaveProduct = async () => {
    if (!title.trim()) {
      toast.error("Informe o título do produto.");
      return;
    }
    const finalSlug = slug.trim() || slugify(title);
    if (!finalSlug) {
      toast.error("Informe o slug do produto.");
      return;
    }
    const numericPrice = parseFloat(price.replace(",", ".")) || 0;
    const numericStock = parseInt(stock, 10) || 0;

    setSaving(true);
    try {
      let productId = editingProduct?.id;

      if (editingProduct) {
        // Update product
        const { error } = await supabase
          .from("products")
          .update({
            title: title.trim(),
            slug: finalSlug,
            category: category.trim() || null,
            price: numericPrice,
            stock: numericStock,
            description: description.trim() || null,
            is_active: isActive,
            is_featured: isFeatured,
          })
          .eq("id", editingProduct.id);

        if (error) throw error;
      } else {
        // Insert product
        const { data, error } = await supabase
          .from("products")
          .insert({
            title: title.trim(),
            slug: finalSlug,
            category: category.trim() || null,
            price: numericPrice,
            stock: numericStock,
            description: description.trim() || null,
            is_active: isActive,
            is_featured: isFeatured,
          })
          .select("id")
          .single();

        if (error) throw error;
        productId = data.id;
      }

      if (productId) {
        // Update images
        await supabase.from("product_images").delete().eq("product_id", productId);
        if (images.length > 0) {
          const { error: imgError } = await supabase.from("product_images").insert(
            images.map((img, idx) => ({
              product_id: productId!,
              url: img.url,
              storage_path: img.storage_path ?? null,
              sort_order: idx,
            })),
          );
          if (imgError) throw imgError;
        }

        // Update attribute values
        await supabase.from("product_attribute_values").delete().eq("product_id", productId);
        if (selectedAttributeValues.size > 0) {
          const { error: attrError } = await supabase.from("product_attribute_values").insert(
            Array.from(selectedAttributeValues).map((valId) => ({
              product_id: productId!,
              attribute_value_id: valId,
            })),
          );
          if (attrError) throw attrError;
        }
      }

      toast.success(
        editingProduct ? "Produto atualizado com sucesso!" : "Produto cadastrado com sucesso!",
      );
      setIsDialogOpen(false);
      onRefresh();
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Erro ao salvar produto.";
      toast.error(msg.includes("unique") ? "Já existe um produto com este slug." : msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!productToDelete) return;
    try {
      // Remove images from storage
      for (const img of productToDelete.product_images) {
        if (img.storage_path) {
          await removeCatalogImage(img.storage_path).catch(console.error);
        }
      }
      const { error } = await supabase.from("products").delete().eq("id", productToDelete.id);
      if (error) throw error;
      toast.success("Produto excluído com sucesso.");
      setProductToDelete(null);
      onRefresh();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao excluir produto.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar produtos..."
              className="pl-9"
            />
          </div>
          {categories.length > 0 && (
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <Button onClick={openCreateDialog} className="shrink-0">
          <Plus className="mr-2 h-4 w-4" /> Novo Produto
        </Button>
      </div>

      {filteredProducts.length === 0 ? (
        <div className="surface-panel p-12 text-center">
          <Package className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 font-display text-lg">Nenhum produto encontrado</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {search || selectedCategory !== "all"
              ? "Tente ajustar os filtros de busca."
              : "Comece cadastrando seu primeiro produto no catálogo."}
          </p>
          <Button onClick={openCreateDialog} className="mt-6">
            <Plus className="mr-2 h-4 w-4" /> Cadastrar Produto
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProducts.map((p) => {
            const firstImg = p.product_images.sort((a, b) => a.sort_order - b.sort_order)[0];
            return (
              <div
                key={p.id}
                className="surface-panel flex flex-col overflow-hidden transition-all hover:border-primary/50"
              >
                <div className="relative aspect-square w-full overflow-hidden bg-secondary">
                  {firstImg ? (
                    <img src={firstImg.url} alt={p.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-xs text-muted-foreground">
                      Sem foto
                    </div>
                  )}
                  <div className="absolute right-2 top-2 flex flex-col gap-1">
                    <Badge variant={p.is_active ? "default" : "secondary"}>
                      {p.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                    {p.is_featured && (
                      <Badge variant="outline" className="bg-background/80">
                        Destaque
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex flex-1 flex-col p-4">
                  {p.category && (
                    <span className="text-[10px] uppercase tracking-widest text-primary">
                      {p.category}
                    </span>
                  )}
                  <h4 className="font-display text-base font-semibold leading-tight line-clamp-2">
                    {p.title}
                  </h4>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-base font-bold">{formatPrice(p.price)}</span>
                    <span className="text-xs text-muted-foreground">
                      Estoque: <strong className="text-foreground">{p.stock}</strong>
                    </span>
                  </div>

                  <div className="mt-auto pt-4 flex items-center justify-between border-t border-border gap-2">
                    <Button variant="outline" size="sm" asChild className="h-8 px-2 text-xs">
                      <Link to="/produto/$slug" params={{ slug: p.slug }} target="_blank">
                        <Eye className="mr-1 h-3.5 w-3.5" /> Ver
                      </Link>
                    </Button>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditDialog(p)}
                        title="Editar"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={() => setProductToDelete(p)}
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DIALOG DE CADASTRO / EDIÇÃO */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {editingProduct ? "Editar Produto" : "Novo Produto"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="prod-title">Título do Produto *</Label>
                <Input
                  id="prod-title"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Ex: Conjunto Renda Luxo"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prod-slug">Slug (URL amigável)</Label>
                <Input
                  id="prod-slug"
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setCustomSlug(true);
                  }}
                  placeholder="ex: conjunto-renda-luxo"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prod-cat">Categoria</Label>
                <Input
                  id="prod-cat"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Ex: Lingerie, Calcinhas, Sutiãs..."
                  list="categories-list"
                />
                <datalist id="categories-list">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              <div className="space-y-2">
                <Label htmlFor="prod-price">Preço (R$) *</Label>
                <Input
                  id="prod-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0,00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prod-stock">Estoque (Qtd) *</Label>
                <Input
                  id="prod-stock"
                  type="number"
                  min="0"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  placeholder="10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prod-desc">Descrição do Produto</Label>
              <Textarea
                id="prod-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalhes sobre tecido, caimento, cuidados e medidas..."
                rows={3}
              />
            </div>

            {/* FOTOS POR UPLOAD */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Fotos do Produto</Label>
                <label className="cursor-pointer">
                  <span className="inline-flex items-center justify-center rounded-md text-xs font-medium bg-primary text-primary-foreground h-8 px-3 hover:bg-primary/90">
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                    {uploadingImage ? "Enviando..." : "Adicionar Fotos"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                  />
                </label>
              </div>

              {images.length === 0 ? (
                <div className="border border-dashed border-border rounded-lg p-6 text-center text-xs text-muted-foreground">
                  Nenhuma foto adicionada. Clique em "Adicionar Fotos" para fazer upload.
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {images.map((img, idx) => (
                    <div
                      key={img.url + idx}
                      className="group relative aspect-square rounded-md overflow-hidden border border-border bg-secondary"
                    >
                      <img src={img.url} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-90 hover:opacity-100"
                        title="Remover foto"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                      {idx === 0 && (
                        <span className="absolute bottom-1 left-1 bg-background/90 text-[10px] font-semibold px-1.5 py-0.5 rounded text-foreground">
                          Principal
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ATRIBUTOS E VARIAÇÕES */}
            <div className="space-y-4 pt-2 border-t border-border">
              <Label>Atributos Disponíveis (Selecione as opções deste produto)</Label>
              {attributes.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhum atributo cadastrado. Crie atributos na aba "Atributos".
                </p>
              ) : (
                <div className="space-y-3">
                  {attributes.map((attr) => (
                    <div key={attr.id} className="rounded-lg border border-border p-3 space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                        {attr.name}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {attr.attribute_values.map((val) => {
                          const isSelected = selectedAttributeValues.has(val.id);
                          return (
                            <button
                              key={val.id}
                              type="button"
                              onClick={() => toggleAttributeValue(val.id)}
                              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                                isSelected
                                  ? "border-primary bg-primary text-primary-foreground font-medium"
                                  : "border-border hover:border-primary/60 text-muted-foreground"
                              }`}
                            >
                              {val.color_hex && (
                                <span
                                  className="h-2.5 w-2.5 rounded-full border border-border"
                                  style={{ backgroundColor: val.color_hex }}
                                />
                              )}
                              {val.value}
                              {isSelected && <Check className="h-3 w-3 ml-0.5" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* STATUS SWITCHES */}
            <div className="flex flex-wrap gap-6 pt-2 border-t border-border">
              <div className="flex items-center space-x-2">
                <Switch id="prod-active" checked={isActive} onCheckedChange={setIsActive} />
                <Label htmlFor="prod-active" className="cursor-pointer">
                  Produto Ativo (visível na loja)
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch id="prod-featured" checked={isFeatured} onCheckedChange={setIsFeatured} />
                <Label htmlFor="prod-featured" className="cursor-pointer">
                  Destaque na Vitrine
                </Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSaveProduct} disabled={saving}>
              {saving ? "Salvando..." : "Salvar Produto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ALERT DIALOG PARA EXCLUSÃO */}
      <AlertDialog
        open={Boolean(productToDelete)}
        onOpenChange={(open) => !open && setProductToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Produto?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o produto <strong>{productToDelete?.title}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProduct}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* =========================================================================
 * SUB-COMPONENTE: GESTÃO DE ATRIBUTOS E VARIAÇÕES
 * ========================================================================= */
function AttributesTab({
  attributes,
  onRefresh,
}: {
  attributes: Attribute[];
  onRefresh: () => void;
}) {
  const [newAttrName, setNewAttrName] = useState("");
  const [addingAttr, setAddingAttr] = useState(false);

  const [selectedAttrForVal, setSelectedAttrForVal] = useState<Attribute | null>(null);
  const [newValText, setNewValText] = useState("");
  const [newValColor, setNewValColor] = useState("");
  const [savingVal, setSavingVal] = useState(false);

  const [attrToDelete, setAttrToDelete] = useState<Attribute | null>(null);

  const handleAddAttribute = async () => {
    if (!newAttrName.trim()) return;
    setAddingAttr(true);
    try {
      const { error } = await supabase.from("attributes").insert({
        name: newAttrName.trim(),
        sort_order: attributes.length + 1,
      });
      if (error) throw error;
      toast.success(`Atributo "${newAttrName}" criado!`);
      setNewAttrName("");
      onRefresh();
    } catch (err: unknown) {
      console.error(err);
      toast.error("Erro ao criar atributo. Verifique se o nome já existe.");
    } finally {
      setAddingAttr(false);
    }
  };

  const handleDeleteAttribute = async () => {
    if (!attrToDelete) return;
    try {
      const { error } = await supabase.from("attributes").delete().eq("id", attrToDelete.id);
      if (error) throw error;
      toast.success(`Atributo "${attrToDelete.name}" excluído.`);
      setAttrToDelete(null);
      onRefresh();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao excluir atributo.");
    }
  };

  const handleAddValue = async () => {
    if (!selectedAttrForVal || !newValText.trim()) return;
    setSavingVal(true);
    try {
      const { error } = await supabase.from("attribute_values").insert({
        attribute_id: selectedAttrForVal.id,
        value: newValText.trim(),
        color_hex: newValColor.trim() || null,
        sort_order: selectedAttrForVal.attribute_values.length + 1,
      });
      if (error) throw error;
      toast.success(`Opção "${newValText}" adicionada a ${selectedAttrForVal.name}!`);
      setNewValText("");
      setNewValColor("");
      setSelectedAttrForVal(null);
      onRefresh();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao adicionar valor. Verifique se já não existe nesta lista.");
    } finally {
      setSavingVal(false);
    }
  };

  const handleDeleteValue = async (valId: string, valName: string) => {
    try {
      const { error } = await supabase.from("attribute_values").delete().eq("id", valId);
      if (error) throw error;
      toast.success(`Opção "${valName}" removida.`);
      onRefresh();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao remover opção.");
    }
  };

  return (
    <div className="space-y-8">
      {/* CRIAR NOVO ATRIBUTO */}
      <div className="surface-panel p-5">
        <h3 className="font-display text-base font-semibold">Criar Novo Atributo</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Exemplos: Tamanho, Cor, Número, Tecido, Bojo, Estampa...
        </p>
        <div className="mt-4 flex max-w-md gap-3">
          <Input
            value={newAttrName}
            onChange={(e) => setNewAttrName(e.target.value)}
            placeholder="Nome do atributo (ex: Tecido)"
          />
          <Button onClick={handleAddAttribute} disabled={addingAttr || !newAttrName.trim()}>
            <Plus className="mr-1.5 h-4 w-4" /> Criar
          </Button>
        </div>
      </div>

      {/* LISTA DE ATRIBUTOS E VALORES */}
      <div className="space-y-6">
        {attributes.map((attr) => (
          <div key={attr.id} className="surface-panel p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h4 className="font-display text-lg font-semibold">{attr.name}</h4>
                <p className="text-xs text-muted-foreground">
                  {attr.attribute_values.length} opções cadastradas
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedAttrForVal(attr);
                    setNewValText("");
                    setNewValColor("");
                  }}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar Opção
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => setAttrToDelete(attr)}
                  title="Excluir atributo"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {attr.attribute_values.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  Nenhuma opção cadastrada ainda.
                </p>
              ) : (
                attr.attribute_values.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-3 py-1.5 text-xs"
                  >
                    {v.color_hex && (
                      <span
                        className="h-3 w-3 rounded-full border border-border"
                        style={{ backgroundColor: v.color_hex }}
                      />
                    )}
                    <span className="font-medium">{v.value}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteValue(v.id, v.value)}
                      className="text-muted-foreground hover:text-destructive ml-1"
                      title="Remover"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* DIALOG ADICIONAR VALOR */}
      <Dialog
        open={Boolean(selectedAttrForVal)}
        onOpenChange={(open) => !open && setSelectedAttrForVal(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Opção em "{selectedAttrForVal?.name}"</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="val-name">Valor / Nome da Opção *</Label>
              <Input
                id="val-name"
                value={newValText}
                onChange={(e) => setNewValText(e.target.value)}
                placeholder="Ex: P, M, G, GG, EXG, 38, Renda, etc."
              />
            </div>
            {selectedAttrForVal?.name.toLowerCase().includes("cor") && (
              <div className="space-y-2">
                <Label htmlFor="val-color">Cor Hexadecimal (Opcional)</Label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    id="val-color-picker"
                    value={newValColor || "#000000"}
                    onChange={(e) => setNewValColor(e.target.value)}
                    className="h-10 w-12 rounded border border-input cursor-pointer bg-transparent"
                  />
                  <Input
                    id="val-color"
                    value={newValColor}
                    onChange={(e) => setNewValColor(e.target.value)}
                    placeholder="#FF007F"
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedAttrForVal(null)}>
              Cancelar
            </Button>
            <Button onClick={handleAddValue} disabled={savingVal || !newValText.trim()}>
              {savingVal ? "Salvando..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ALERT DIALOG EXCLUSÃO DE ATRIBUTO */}
      <AlertDialog
        open={Boolean(attrToDelete)}
        onOpenChange={(open) => !open && setAttrToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Atributo?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o atributo <strong>{attrToDelete?.name}</strong> e
              todas as suas opções?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAttribute}
              className="bg-destructive text-destructive-foreground"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* =========================================================================
 * SUB-COMPONENTE: CONFIGURAÇÕES DA LOJA & LOGO
 * ========================================================================= */
function SettingsTab({ settings, onRefresh }: { settings: SiteSettings; onRefresh: () => void }) {
  const [siteName, setSiteName] = useState(settings.site_name || "");
  const [tagline, setTagline] = useState(settings.tagline || "");
  const [about, setAbout] = useState(settings.about || "");
  const [logoUrl, setLogoUrl] = useState(settings.logo_url || "");
  const [whatsapp, setWhatsapp] = useState(settings.whatsapp || "");
  const [email, setEmail] = useState(settings.email || "");
  const [instagram, setInstagram] = useState(settings.instagram || "");
  const [address, setAddress] = useState(settings.address || "");
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const { url } = await uploadCatalogImage(file, "logo");
      setLogoUrl(url);
      toast.success("Logo enviada!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao enviar imagem da logo.");
    } finally {
      setUploadingLogo(false);
      e.target.value = "";
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("site_settings")
        .update({
          site_name: siteName.trim() || "Meu Catálogo",
          tagline: tagline.trim() || null,
          about: about.trim() || null,
          logo_url: logoUrl.trim() || null,
          whatsapp: whatsapp.trim() || null,
          email: email.trim() || null,
          instagram: instagram.trim() || null,
          address: address.trim() || null,
        })
        .eq("id", true);

      if (error) throw error;
      toast.success("Configurações atualizadas com sucesso!");
      onRefresh();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar configurações.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="surface-panel max-w-3xl p-6 space-y-6">
      <div>
        <h3 className="font-display text-xl font-semibold">Informações do Site & Loja</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Personalize os dados de contato, WhatsApp para recebimento de pedidos e logo da sua marca.
        </p>
      </div>

      <div className="space-y-4">
        {/* LOGO */}
        <div className="space-y-2">
          <Label>Logo da Loja</Label>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 shrink-0 rounded-full border border-border bg-secondary overflow-hidden grid place-items-center">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <label className="cursor-pointer">
                <span className="inline-flex items-center justify-center rounded-md text-xs font-medium bg-primary text-primary-foreground h-8 px-3 hover:bg-primary/90">
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  {uploadingLogo ? "Enviando..." : "Fazer Upload da Logo"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                  disabled={uploadingLogo}
                />
              </label>
              {logoUrl && (
                <button
                  type="button"
                  onClick={() => setLogoUrl("")}
                  className="text-xs text-destructive hover:underline text-left"
                >
                  Remover logo
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="set-name">Nome da Loja *</Label>
            <Input
              id="set-name"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              placeholder="Ex: MR7 Lingerie"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="set-tagline">Slogan / Tagline</Label>
            <Input
              id="set-tagline"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="Ex: Peças selecionadas, entrega rápida"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="set-about">Sobre a Loja / Descrição</Label>
          <Textarea
            id="set-about"
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            placeholder="Apresente sua loja aos clientes..."
            rows={3}
          />
        </div>

        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
          <div className="flex items-center gap-2 text-primary font-medium text-sm">
            <MessageCircle className="h-4 w-4" />
            WhatsApp do Administrador (Recebimento de Pedidos) *
          </div>
          <p className="text-xs text-muted-foreground">
            Insira o número com DDD. Quando o cliente finalizar a compra no carrinho, o pedido será
            formatado e enviado diretamente para este WhatsApp.
          </p>
          <Input
            id="set-whatsapp"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="(11) 99999-9999 ou 11999999999"
            className="max-w-md bg-background"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="set-email">E-mail de Contato</Label>
            <Input
              id="set-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contato@sualoja.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="set-insta">Instagram (@)</Label>
            <Input
              id="set-insta"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="@sualoja"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="set-address">Endereço Comercial / Localização</Label>
          <Input
            id="set-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Ex: São Paulo - SP / Atendimento Online"
          />
        </div>
      </div>

      <div className="pt-4 border-t border-border">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </div>
    </div>
  );
}

/* =========================================================================
 * SUB-COMPONENTE: GESTÃO DE PEDIDOS
 * ========================================================================= */
function OrdersTab({ orders, onRefresh }: { orders: Order[]; onRefresh: () => void }) {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .eq("id", orderId);
      if (error) throw error;
      toast.success("Status do pedido atualizado!");
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus });
      }
      onRefresh();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao atualizar status.");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "novo":
        return (
          <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700">
            Novo
          </Badge>
        );
      case "em_atendimento":
        return (
          <Badge variant="secondary" className="bg-amber-600/20 text-amber-500 border-amber-600/30">
            Em Atendimento
          </Badge>
        );
      case "concluido":
        return (
          <Badge variant="outline" className="text-emerald-500 border-emerald-500/30">
            Concluído
          </Badge>
        );
      case "cancelado":
        return <Badge variant="destructive">Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {orders.length === 0 ? (
        <div className="surface-panel p-12 text-center">
          <ShoppingBag className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 font-display text-lg">Nenhum pedido recebido ainda</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Os pedidos enviados pelos clientes via carrinho aparecerão listados aqui.
          </p>
        </div>
      ) : (
        <div className="surface-panel overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-secondary/30 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-4">Data</th>
                <th className="p-4">Cliente</th>
                <th className="p-4">Telefone</th>
                <th className="p-4">Total</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-secondary/20 transition-colors">
                  <td className="p-4 whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(o.created_at).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="p-4 font-medium">{o.customer_name}</td>
                  <td className="p-4 text-muted-foreground">{o.customer_phone}</td>
                  <td className="p-4 font-bold">{formatPrice(o.total)}</td>
                  <td className="p-4">{getStatusBadge(o.status)}</td>
                  <td className="p-4 text-right space-x-2 whitespace-nowrap">
                    <Button variant="outline" size="sm" onClick={() => setSelectedOrder(o)}>
                      Detalhes
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      className="text-emerald-500 hover:text-emerald-400"
                    >
                      <a
                        href={formatWhatsappUrl(
                          o.customer_phone,
                          `Olá ${o.customer_name}! Recebemos seu pedido no catálogo virtual no valor de ${formatPrice(o.total)}.`,
                        )}
                        target="_blank"
                        rel="noreferrer"
                        title="Conversar no WhatsApp"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </a>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL DE DETALHES DO PEDIDO */}
      <Dialog
        open={Boolean(selectedOrder)}
        onOpenChange={(open) => !open && setSelectedOrder(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Detalhes do Pedido</DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-2 text-sm border-b border-border pb-3">
                <div>
                  <span className="text-xs text-muted-foreground">Cliente:</span>
                  <p className="font-semibold">{selectedOrder.customer_name}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Telefone:</span>
                  <p>{selectedOrder.customer_phone}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-xs text-muted-foreground">Status do Pedido:</span>
                  <div className="mt-1">
                    <Select
                      value={selectedOrder.status}
                      onValueChange={(val) => handleUpdateStatus(selectedOrder.id, val)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="novo">Novo</SelectItem>
                        <SelectItem value="em_atendimento">Em Atendimento</SelectItem>
                        <SelectItem value="concluido">Concluído</SelectItem>
                        <SelectItem value="cancelado">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {selectedOrder.note && (
                  <div className="col-span-2 pt-1">
                    <span className="text-xs text-muted-foreground">Observações:</span>
                    <p className="text-xs italic bg-secondary/50 p-2 rounded mt-0.5">
                      {selectedOrder.note}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <h5 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                  Itens do Pedido
                </h5>
                <div className="space-y-2">
                  {selectedOrder.order_items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-lg border border-border p-2.5 text-sm"
                    >
                      <div>
                        <p className="font-medium">
                          {item.quantity}x {item.title}
                        </p>
                        {item.options && (
                          <p className="text-xs text-muted-foreground">{item.options}</p>
                        )}
                      </div>
                      <span className="font-semibold">
                        {formatPrice(item.unit_price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border pt-3 text-base">
                <span className="font-semibold">Total do Pedido:</span>
                <span className="font-display text-xl font-bold text-primary">
                  {formatPrice(selectedOrder.total)}
                </span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedOrder(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* =========================================================================
 * COMPONENTE PRINCIPAL DA PÁGINA ADMIN
 * ========================================================================= */
function AdminPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { session, isAdmin, loading: authLoading } = useSession();

  const { data: settings, refetch: refetchSettings } = useQuery(siteSettingsQuery);
  const { data: products = [], refetch: refetchProducts } = useQuery(
    productsQuery({ includeInactive: true }),
  );
  const { data: attributes = [], refetch: refetchAttributes } = useQuery(attributesQuery);
  const { data: orders = [], refetch: refetchOrders } = useQuery(ordersQuery);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    queryClient.clear();
    navigate({ to: "/" });
  };

  const handleRefreshAll = () => {
    refetchSettings();
    refetchProducts();
    refetchAttributes();
    refetchOrders();
  };

  if (authLoading) {
    return (
      <div className="mx-auto max-w-6xl p-8 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  // If not logged in or not admin, show access card
  if (!session || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="surface-panel max-w-md w-full p-8 text-center space-y-5">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
            <AlertCircle className="h-7 w-7" />
          </div>
          <h2 className="font-display text-2xl font-semibold">Acesso Restrito</h2>
          <p className="text-sm text-muted-foreground">
            Você precisa estar conectado com uma conta de administrador para acessar o painel de
            controle.
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <Button asChild size="lg">
              <Link to="/auth">Fazer Login</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/">Voltar à Loja</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* HEADER DO ADMIN */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 group">
              {settings?.logo_url ? (
                <img src={settings.logo_url} alt="" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <div className="grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground font-display text-xs">
                  A
                </div>
              )}
              <div>
                <span className="font-display text-base font-semibold group-hover:text-primary transition-colors">
                  {settings?.site_name ?? "Painel Admin"}
                </span>
                <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                  Painel de Controle
                </span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex text-xs">
              <Link to="/" target="_blank">
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Ver Loja
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="text-xs"
              title="Sair da conta"
            >
              <LogOut className="mr-1.5 h-3.5 w-3.5" /> Sair
            </Button>
          </div>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL DO PAINEL */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <Tabs defaultValue="products" className="space-y-6">
          <div className="border-b border-border pb-3">
            <TabsList className="bg-secondary/40 p-1 flex-wrap h-auto">
              <TabsTrigger value="products" className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Produtos ({products.length})
              </TabsTrigger>
              <TabsTrigger value="attributes" className="flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Atributos ({attributes.length})
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Configurações da Loja
              </TabsTrigger>
              <TabsTrigger value="orders" className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4" />
                Pedidos ({orders.length})
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="products" className="outline-none">
            <ProductsTab products={products} attributes={attributes} onRefresh={handleRefreshAll} />
          </TabsContent>

          <TabsContent value="attributes" className="outline-none">
            <AttributesTab attributes={attributes} onRefresh={handleRefreshAll} />
          </TabsContent>

          <TabsContent value="settings" className="outline-none">
            {settings && <SettingsTab settings={settings} onRefresh={handleRefreshAll} />}
          </TabsContent>

          <TabsContent value="orders" className="outline-none">
            <OrdersTab orders={orders} onRefresh={handleRefreshAll} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
