import { Request, Response } from "express";
import { Product } from "../types/product";
import { ref, get, set, push, remove } from "firebase/database";
import { database } from "../firebaseConfig";

let productsCache: any = null;
let lastFetch = 0;
let compareTime = 120_000

const fetchReset = () => {
  lastFetch = Date.now() - compareTime;
}

export const getAll = async (_req: Request, res: Response) => {
  try {
    if (productsCache && Date.now() - lastFetch < compareTime) {
      return res.json(productsCache);
    }

    const snapshot = await get(ref(database, "products"));

    const products = snapshot.exists()
      ? Object.entries(snapshot.val()).flatMap(([categoryName, items]: any) =>
          Object.entries(items).map(([id, product]: any) => ({
            id,
            category: categoryName,
            ...product,
          })),
        )
      : [];

    // تحديث الكاش
    productsCache = products;
    lastFetch = Date.now();

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
    if (!id) return res.status(400).json({ message: "product id is required" });

    const productsSnapshot = await get(ref(database, "products"));
    if (!productsSnapshot.exists())
      return res.status(404).json({ message: "المنتج غير موجود" });

    const warehouses = productsSnapshot.val();
    let foundProduct: any = null;
    let foundWarehouse: string | null = null;

    for (const warehouse in warehouses) {
      for (const productId in warehouses[warehouse]) {
        const p = warehouses[warehouse][productId];
        if (p.id === id) {
          foundProduct = p;
          foundWarehouse = warehouse;
          break;
        }
      }
      if (foundProduct) break;
    }

    if (!foundProduct)
      return res.status(404).json({ message: "❌ المنتج غير موجود" });

    const transfersSnapshot = await get(ref(database, "warehouseTransfers"));
    const transfersData = transfersSnapshot.exists()
      ? transfersSnapshot.val()
      : {};

    const transfers = Object.values(transfersData)
      .filter(
        (t: any) =>
          t.productId === foundProduct.id ||
          t.productCode === foundProduct.code,
      )
      .map((t: any) => ({
        ...t,
        type: "transfer", // لتمييزها في الواجهة
      }));

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
          p.code === foundProduct.code &&
          p.warehouse === foundProduct.warehouse,
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
            prod.warehouse === foundProduct.warehouse,
        ),
      )
      .map((sell: any) => {
        const matchedProduct = sell.products.find(
          (prod: any) =>
            prod.code === foundProduct.code &&
            prod.warehouse === foundProduct.warehouse,
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

    res.json({ product: foundProduct, purchases, sells, transfers });
  } catch (error) {
    console.error("❌ خطأ في جلب المنتج:", error);
    res.status(500).json({ message: "حدث خطأ أثناء جلب المنتج" });
  }
};

export const create = async (req: Request, res: Response) => {
  try {
    const newProduct: Product = req.body;

    if (!newProduct.warehouse)
      return res.status(400).json({ message: "warehouse is required" });

    const NowDate = new Date().toLocaleString();

    const warehouseRef = ref(database, `products/${newProduct.warehouse}`);
    const newRef = push(warehouseRef);

    const productData: Product = {
      ...newProduct,
      id: newRef.key!,
      updatedDate: NowDate,
    };

    await set(newRef, productData);

    fetchReset();

    res.json({
      message: "تم إنشاء المنتج بنجاح",
      data: productData,
    });
  } catch (error) {
    console.error("❌ خطأ أثناء إنشاء المنتج:", error);
    res.status(500).json({ message: "حدث خطأ أثناء إنشاء المنتج" });
  }
};

// ✅ تحديث كمية المنتج بعد بيع داخليًا
export const updateQuantityOnSell = async (
  productId: string,
  warehouse: string,
  soldQuantity: number,
): Promise<Product | null> => {
  const productRef = ref(database, `products/${warehouse}/${productId}`);
  console.log(soldQuantity);
  const snapshot = await get(productRef);
  if (!snapshot.exists()) return null;

  const existingProduct: Product = snapshot.val();
  if (existingProduct.quantity < soldQuantity) {
    console.log(
      `❌ الكمية غير كافية. المتاح: ${existingProduct.quantity}, المطلوب: ${soldQuantity}`,
    );
    throw new Error(
      `❌ الكمية غير كافية. المتاح: ${existingProduct.quantity}, المطلوب: ${soldQuantity}`,
    );
  }
  console.log(existingProduct);

  fetchReset();

  const newQuantity = existingProduct.quantity - soldQuantity;
  existingProduct.quantity = newQuantity;
  existingProduct.updatedDate = new Date().toLocaleString();
  console.log(existingProduct);
  await set(productRef, existingProduct);

  return existingProduct;
};

export const updateProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updatedFields = req.body;

    const snapshot = await get(ref(database, "products"));
    if (!snapshot.exists())
      return res.status(404).json({ message: "المنتج غير موجود" });

    const warehouses = snapshot.val();

    fetchReset();

    for (const warehouse in warehouses) {
      for (const productId in warehouses[warehouse]) {
        if (productId === id) {
          const newData = {
            ...warehouses[warehouse][productId],
            ...updatedFields,
            updatedDate: new Date().toLocaleString(),
          };

          await set(
            ref(database, `products/${warehouse}/${productId}`),
            newData,
          );

          return res.json({ message: "تم تحديث المنتج", data: newData });
        }
      }
    }

    res.status(404).json({ message: "المنتج غير موجود" });
  } catch (error) {
    console.error("❌ خطأ أثناء تحديث المنتج:", error);
    res.status(500).json({ message: "حدث خطأ أثناء تحديث المنتج" });
  }
};

export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const snapshot = await get(ref(database, "products"));
    if (!snapshot.exists())
      return res.status(404).json({ message: "المنتج غير موجود" });

    const warehouses = snapshot.val();

    for (const warehouse in warehouses) {
      for (const productId in warehouses[warehouse]) {
        if (productId === id) {
          await remove(ref(database, `products/${warehouse}/${productId}`));
          return res.json({ message: "تم حذف المنتج" });
        }
      }
    }

    fetchReset();

    res.status(404).json({ message: "المنتج غير موجود" });
  } catch (error) {
    console.error("❌ خطأ أثناء حذف المنتج:", error);
    res.status(500).json({ message: "حدث خطأ أثناء حذف المنتج" });
  }
};

export const createOrUpdateProductInternal = async (
  newProduct: Product,
): Promise<Product> => {
  const NowDate = new Date().toLocaleString();

  const warehousePath = `products/${newProduct.warehouse}`;
  const warehouseRef = ref(database, warehousePath);

  // 1) قراءة كل المنتجات داخل نفس المستودع
  const snapshot = await get(warehouseRef);

  if (snapshot.exists()) {
    const products = snapshot.val();

    // 2) البحث عن منتج بنفس code
    for (const productId in products) {
      const existingProduct: Product = products[productId];

      if (existingProduct.code === newProduct.code) {
        // تحديث المنتج
        const updatedProduct: Product = {
          ...existingProduct,
          ...newProduct,
          quantity: existingProduct.quantity + newProduct.quantity,
          updatedDate: NowDate,
          id: productId, // مهم جداً: المفتاح من الـ DB
        };

        // حفظ التحديث
        await set(
          ref(database, `${warehousePath}/${productId}`),
          updatedProduct,
        );
        return updatedProduct;
      }
    }
  }

  // 3) إذا لم يوجد منتج بنفس code → نقوم بالإنشاء
  const newRef = push(warehouseRef);

  const productToAdd: Product = {
    ...newProduct,
    updatedDate: NowDate,
    id: newRef.key!, // id هو مفتاح push في Firebase
  };

  await set(newRef, productToAdd);

  fetchReset();

  return productToAdd;
};

// ✅ جلب منتج واحد حسب id + المشتريات والمبيعات
export const getProductByIdInternal = async (id: string) => {
  try {
    if (!id) return { message: "product id is required" };

    const productsSnapshot = await get(ref(database, "products"));
    if (!productsSnapshot.exists()) return { message: "المنتج غير موجود" };

    const warehouses = productsSnapshot.val();
    let foundProduct: any = null;
    let foundWarehouse: string | null = null;

    for (const warehouse in warehouses) {
      for (const productId in warehouses[warehouse]) {
        const p = warehouses[warehouse][productId];
        if (p.id === id) {
          foundProduct = p;
          foundWarehouse = warehouse;
          break;
        }
      }
      if (foundProduct) break;
    }

    if (!foundProduct) return { message: "❌ المنتج غير موجود" };

    return { product: foundProduct };
  } catch (error) {
    console.error("❌ خطأ في جلب المنتج:", error);
    return { message: "حدث خطأ أثناء جلب المنتج" };
  }
};

export const getByWarehouse = async (req: Request, res: Response) => {
  try {
    const { warehouse } = req.body;
    console.log(warehouse)

    const productsSnapshot = await get(ref(database, `products/${warehouse}`));

    if (!productsSnapshot.exists()) {
      return res.json({ products: [] });
    }

    const data = productsSnapshot.val();
    const products = Object.values(data);

    res.json({ products });
  } catch (error) {
    console.error("❌ خطأ في جلب المنتجات:", error);
    res
      .status(500)
      .json({ products: [], message: "حدث خطأ أثناء جلب المنتجات" });
  }
};
