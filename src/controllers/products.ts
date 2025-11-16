import { Request, Response } from "express";
import { Product } from "../types/product";
import { v4 as uuidv4 } from "uuid";
import { ref, get, set, update, remove } from "firebase/database";
import { database } from "../firebaseConfig";

// ✅ جلب جميع المنتجات
export const getAll = async (_req: Request, res: Response) => {
  try {
    const snapshot = await get(ref(database, "products"));
    const products = snapshot.exists() ? Object.values(snapshot.val()) : [];
    res.json(products);
  } catch (error) {
    console.error("❌ خطأ في جلب المنتجات:", error);
    res.status(500).json({ message: "حدث خطأ أثناء جلب المنتجات" });
  }
};

// ✅ جلب منتج واحد حسب id + المشتريات والمبيعات
export const getProductById = async (req: Request, res: Response) => {
  try {
    const { id } = req.body;
    if (!id)
      return res.status(400).json({ message: "❌ product id is required" });

    const productsSnapshot = await get(ref(database, "products"));
    if (!productsSnapshot.exists())
      return res.status(404).json({ message: "❌ المنتج غير موجود" });

    const productsData = productsSnapshot.val();
    let foundProduct: Product | null = null;

    // البحث عن المنتج داخل جميع المستودعات
    for (const warehouse in productsData) {
      for (const code in productsData[warehouse]) {
        const prod = productsData[warehouse][code];
        if (prod.id === id) {
          foundProduct = prod;
          break;
        }
      }
      if (foundProduct) break;
    }

    if (!foundProduct)
      return res.status(404).json({ message: "❌ المنتج غير موجود" });

    // جلب المشتريات
    const purchasesSnapshot = await get(ref(database, "purchases"));
    const purchasesData = purchasesSnapshot.exists()
      ? purchasesSnapshot.val()
      : {};
    const supplierSnapshot = await get(ref(database, "supplier"));
    const supplierData = supplierSnapshot.exists()
      ? supplierSnapshot.val()
      : {};

    const purchases = Object.values(purchasesData)
      .filter(
        (p: any) =>
          p.code === foundProduct.code && p.warehouse === foundProduct.warehouse
      )
      .map((p: any) => ({
        ...p,
        supplierName: supplierData[p.supplierId]?.name || "مورد غير معروف",
      }));

    // جلب المبيعات
    const sellsSnapshot = await get(ref(database, "sells"));
    const sellsData = sellsSnapshot.exists() ? sellsSnapshot.val() : {};
    const customerSnapshot = await get(ref(database, "customer"));
    const customerData = customerSnapshot.exists()
      ? customerSnapshot.val()
      : {};

    const sells = Object.values(sellsData)
      .filter((sell: any) =>
        sell.products?.some(
          (prod: any) =>
            prod.code === foundProduct.code &&
            prod.warehouse === foundProduct.warehouse
        )
      )
      .map((sell: any) => {
        const matchedProduct = sell.products.find(
          (prod: any) =>
            prod.code === foundProduct.code &&
            prod.warehouse === foundProduct.warehouse
        );
        return {
          ...sell,
          totalPrice: matchedProduct
            ? matchedProduct.sellPrice * matchedProduct.qty
            : 0,
          quantity: matchedProduct ? matchedProduct.qty : 0,
          customerName: customerData[sell.customerId]?.name || "زبون غير معروف",
        };
      });

    res.json({ product: foundProduct, purchases, sells });
  } catch (error) {
    console.error("❌ خطأ في جلب المنتج:", error);
    res.status(500).json({ message: "حدث خطأ أثناء جلب المنتج" });
  }
};

// ✅ إنشاء أو تحديث منتج
export const create = async (req: Request, res: Response) => {
  try {
    const newProduct: Product = req.body;
    const NowDate = new Date().toLocaleString();

    const productRef = ref(
      database,
      `products/${newProduct.warehouse}/${newProduct.code}`
    );
    const snapshot = await get(productRef);

    if (snapshot.exists()) {
      const existingProduct = snapshot.val();
      existingProduct.quantity += newProduct.quantity;
      existingProduct.updatedDate = NowDate;
      await set(productRef, existingProduct);
      return res.json({
        message: "✅ تم تحديث كمية المنتج",
        data: existingProduct,
      });
    }

    const productToAdd: Product = {
      ...newProduct,
      updatedDate: NowDate,
      id: uuidv4(),
    };
    await set(productRef, productToAdd);
    res.json({ message: "✅ تم إنشاء المنتج", data: productToAdd });
  } catch (error) {
    console.error("❌ خطأ أثناء إنشاء المنتج:", error);
    res.status(500).json({ message: "حدث خطأ أثناء إنشاء المنتج" });
  }
};

// ✅ تحديث كمية المنتج بعد بيع داخليًا
export const updateQuantityOnSell = async (
  productId: string,
  warehouse: string,
  soldQuantity: number
): Promise<Product | null> => {
  const productRef = ref(database, `products/${warehouse}/${productId}`);
  const snapshot = await get(productRef);
  if (!snapshot.exists()) return null;

  const existingProduct: Product = snapshot.val();
  if (existingProduct.quantity < soldQuantity) {
    throw new Error(
      `❌ الكمية غير كافية. المتاح: ${existingProduct.quantity}, المطلوب: ${soldQuantity}`
    );
  }

  existingProduct.quantity -= soldQuantity;
  existingProduct.updatedDate = new Date().toLocaleString();
  await set(productRef, existingProduct);

  return existingProduct;
};

// ✅ تحديث بيانات منتج
export const updateProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updatedFields: Partial<Product> = req.body;
    const NowDate = new Date().toLocaleString();

    const productsSnapshot = await get(ref(database, "products"));
    if (!productsSnapshot.exists())
      return res.status(404).json({ message: "❌ المنتج غير موجود" });

    const productsData = productsSnapshot.val();
    let productFound = false;

    for (const warehouse in productsData) {
      for (const code in productsData[warehouse]) {
        const product = productsData[warehouse][code];
        if (product.id === id) {
          const updatedProduct = {
            ...product,
            ...updatedFields,
            updatedDate: NowDate,
          };
          await set(
            ref(database, `products/${warehouse}/${code}`),
            updatedProduct
          );
          productFound = true;
          return res.json({
            message: "✅ تم تحديث بيانات المنتج",
            data: updatedProduct,
          });
        }
      }
    }

    if (!productFound)
      return res.status(404).json({ message: "❌ المنتج غير موجود" });
  } catch (error) {
    console.error("❌ خطأ أثناء تحديث المنتج:", error);
    res.status(500).json({ message: "حدث خطأ أثناء تحديث المنتج" });
  }
};

// ✅ حذف منتج
export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const productsSnapshot = await get(ref(database, "products"));
    if (!productsSnapshot.exists())
      return res.status(404).json({ message: "❌ المنتج غير موجود" });

    const productsData = productsSnapshot.val();
    let productFound = false;

    for (const warehouse in productsData) {
      for (const code in productsData[warehouse]) {
        const product = productsData[warehouse][code];
        if (product.id === id) {
          await remove(ref(database, `products/${warehouse}/${code}`));
          productFound = true;
          return res.json({ message: "🗑️ تم حذف المنتج بنجاح" });
        }
      }
    }

    if (!productFound)
      return res.status(404).json({ message: "❌ المنتج غير موجود" });
  } catch (error) {
    console.error("❌ خطأ أثناء حذف المنتج:", error);
    res.status(500).json({ message: "حدث خطأ أثناء حذف المنتج" });
  }
};
export const createOrUpdateProductInternal = async (
  newProduct: Product
): Promise<Product> => {
  const NowDate = new Date().toLocaleString();
  const productRef = ref(
    database,
    `products/${newProduct.warehouse}/${newProduct.code}`
  );
  const snapshot = await get(productRef);

  if (snapshot.exists()) {
    const existingProduct: Product = snapshot.val();
    existingProduct.quantity += newProduct.quantity;
    existingProduct.updatedDate = NowDate;
    await set(productRef, existingProduct);
    return existingProduct;
  }

  const productToAdd: Product = {
    ...newProduct,
    updatedDate: NowDate,
    id: uuidv4(),
  };
  await set(productRef, productToAdd);
  return productToAdd;
};
