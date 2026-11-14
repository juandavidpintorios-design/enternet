import { useState, useEffect, createContext, useContext } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "./firebase";

// ==================== CONTEXT ====================
const AppContext = createContext();
function useApp() {
  return useContext(AppContext);
}

// ==================== APP PRINCIPAL ====================
export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [siteSettings, setSiteSettings] = useState({
    name: "ENTERNET",
    slogan: "Todo lo digital, en un solo lugar.",
    logoUrl: "",
    nequiNumber: "3216401956",
    nequiName: "Juan Pinto",
    qrUrl: "https://i.postimg.cc/Xn4nNMSG/0f3fadc1-29a5-43b0-8201-24d5d863aa4b.jpg",
  });
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([
    "Entretenimiento",
    "Invitaciones Digitales",
    "Diseños Personalizados",
    "Servicios Digitales",
  ]);
  const [cart, setCart] = useState([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const snap = await getDoc(doc(db, "users", u.uid));
        if (snap.exists()) {
          setUserData({ id: u.uid, ...snap.data() });
        } else {
          const newUser = {
            email: u.email,
            balance: 0,
            role: "user",
            createdAt: serverTimestamp(),
          };
          await setDoc(doc(db, "users", u.uid), newUser);
          setUserData({ id: u.uid, ...newUser });
        }
      } else {
        setUserData(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "site"), (snap) => {
      if (snap.exists()) setSiteSettings((prev) => ({ ...prev, ...snap.data() }));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "categories"), (snap) => {
      if (snap.exists() && snap.data().list) setCategories(snap.data().list);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setProducts(list.filter((p) => p.active !== false));
    });
    return () => unsub();
  }, []);

  // Carrito con variantes
  const addToCart = (product, variant) => {
    if (!variant || variant.stock <= 0) return;

    setCart((prev) => {
      const exists = prev.find(
        (i) => i.productId === product.id && i.duration === variant.duration
      );
      if (exists) {
        return prev.map((i) =>
          i.productId === product.id && i.duration === variant.duration
            ? { ...i, qty: i.qty + 1 }
            : i
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          imageUrl: product.imageUrl,
          duration: variant.duration,
          price: variant.price,
          renewable: product.renewable || false,
          qty: 1,
        },
      ];
    });
  };

  const removeFromCart = (productId, duration) => {
    setCart((prev) =>
      prev.filter((i) => !(i.productId === productId && i.duration === duration))
    );
  };

  const updateQty = (productId, duration, qty) => {
    if (qty < 1) return removeFromCart(productId, duration);
    setCart((prev) =>
      prev.map((i) =>
        i.productId === productId && i.duration === duration
          ? { ...i, qty }
          : i
      )
    );
  };

  const clearCart = () => setCart([]);
  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-purple-400 text-xl animate-pulse">Cargando Enternet...</div>
      </div>
    );
  }

  return (
    <AppContext.Provider
      value={{
        user,
        userData,
        setUserData,
        siteSettings,
        products,
        categories,
        cart,
        addToCart,
        removeFromCart,
        updateQty,
        clearCart,
        cartTotal,
      }}
    >
      <BrowserRouter>
        <div className="min-h-screen bg-[#0a0a0f] text-white">
          <Header />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/productos" element={<ProductsPage />} />
            <Route path="/carrito" element={<CartPage />} />
            <Route path="/recargar" element={<RechargePage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/registro" element={<Register />} />
            <Route path="/recuperar" element={<ForgotPassword />} />
            <Route
              path="/admin/*"
              element={
                userData?.role === "admin" ? <AdminPanel /> : <Navigate to="/" />
              }
            />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
          <Footer />
        </div>
      </BrowserRouter>
    </AppContext.Provider>
  );
}

// ==================== HEADER ====================
function Header() {
  const { user, userData, siteSettings, cart } = useApp();
  const navigate = useNavigate();
  const cartCount = cart.reduce((sum, i) => sum + i.qty, 0);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-50 bg-[#0a0a0f]/95 backdrop-blur border-b border-purple-900/50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-3">
          {siteSettings.logoUrl ? (
            <img
              src={siteSettings.logoUrl}
              alt="Logo"
              className="w-12 h-12 rounded-full object-cover border-2 border-purple-500"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center font-bold text-lg">
              E
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              {siteSettings.name || "ENTERNET"}
            </h1>
            <p className="text-xs text-gray-400 hidden sm:block">{siteSettings.slogan}</p>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm">
          <Link to="/" className="hover:text-purple-400 transition">Inicio</Link>
          <Link to="/productos" className="hover:text-purple-400 transition">Productos</Link>
          <Link to="/carrito" className="hover:text-purple-400 transition relative">
            Carrito
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-3 bg-pink-500 text-xs w-5 h-5 rounded-full flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </Link>
          {user && (
            <Link to="/recargar" className="hover:text-purple-400 transition">
              Recargar
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <div className="text-right hidden sm:block">
                <p className="text-xs text-gray-400">Saldo disponible</p>
                <p className="font-bold text-green-400">
                  ${userData?.balance?.toLocaleString("es-CO") || 0}
                </p>
              </div>
              {userData?.role === "admin" && (
                <Link
                  to="/admin"
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-medium transition"
                >
                  Admin
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition"
              >
                Salir
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="px-3 py-1.5 text-sm hover:text-purple-400 transition">
                Entrar
              </Link>
              <Link
                to="/registro"
                className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-pink-500 rounded-lg text-sm font-medium hover:opacity-90 transition"
              >
                Registrarse
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

// ==================== FOOTER ====================
function Footer() {
  const { siteSettings } = useApp();
  return (
    <footer className="border-t border-purple-900/50 mt-16 py-8">
      <div className="max-w-7xl mx-auto px-4 text-center text-gray-400 text-sm">
        <p className="font-bold text-white mb-1">{siteSettings.name}</p>
        <p>{siteSettings.slogan}</p>
        <p className="mt-4">© {new Date().getFullYear()} — Todos los derechos reservados</p>
      </div>
    </footer>
  );
}

// ==================== HOME ====================
function Home() {
  const { products, siteSettings, categories } = useApp();
  const featured = products.slice(0, 8);

  return (
    <main>
      <section className="relative py-20 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 to-transparent"></div>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          {siteSettings.logoUrl && (
            <img
              src={siteSettings.logoUrl}
              alt="Logo"
              className="w-40 h-40 mx-auto mb-6 rounded-full object-cover border-4 border-purple-500 shadow-lg shadow-purple-500/30"
            />
          )}
          <h2 className="text-4xl md:text-6xl font-black mb-4 bg-gradient-to-r from-purple-300 via-pink-300 to-purple-300 bg-clip-text text-transparent">
            {siteSettings.name}
          </h2>
          <p className="text-xl md:text-2xl text-gray-300 mb-8">{siteSettings.slogan}</p>
          <Link
            to="/productos"
            className="inline-block px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-500 rounded-full font-bold text-lg hover:scale-105 transition shadow-lg shadow-purple-500/40"
          >
            Ver Productos
          </Link>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 py-12">
        <h3 className="text-2xl font-bold mb-8 text-center">Nuestros Servicios</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {categories.map((cat) => (
            <div
              key={cat}
              className="bg-gradient-to-br from-purple-900/40 to-pink-900/20 border border-purple-700/40 rounded-2xl p-6 text-center hover:border-purple-400 transition"
            >
              <p className="font-medium">{cat}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 py-12">
        <h3 className="text-2xl font-bold mb-8">Productos Destacados</h3>
        {featured.length === 0 ? (
          <p className="text-center text-gray-500">
            Aún no hay productos. El administrador puede agregarlos.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

// ==================== PRODUCT CARD (con variantes) ====================
function ProductCard({ product }) {
  const { addToCart } = useApp();
  const variants = product.variants || [];
  const [selected, setSelected] = useState(variants[0] || null);

  // Actualizar selected si cambian las variantes
  useEffect(() => {
    if (variants.length > 0 && !selected) {
      setSelected(variants[0]);
    }
  }, [variants]);

  const handleAdd = () => {
    if (!selected || selected.stock <= 0) return;
    addToCart(product, selected);
  };

  return (
    <div className="bg-[#12121a] border border-purple-900/50 rounded-2xl overflow-hidden hover:border-purple-500/60 transition group">
      <div className="aspect-square bg-black/40 overflow-hidden relative">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl text-purple-700">
            📦
          </div>
        )}
        {product.renewable && (
          <span className="absolute top-2 left-2 bg-green-600 text-xs font-bold px-2 py-1 rounded">
            RENOVABLE
          </span>
        )}
      </div>

      <div className="p-4">
        <h4 className="font-bold text-lg mb-1 line-clamp-1">{product.name}</h4>
        <p className="text-sm text-gray-400 mb-3 line-clamp-2">
          {product.description || "Sin descripción"}
        </p>

        {variants.length > 0 ? (
          <>
            <select
              value={selected?.duration || ""}
              onChange={(e) => {
                const v = variants.find((x) => x.duration === e.target.value);
                setSelected(v);
              }}
              className="w-full mb-3 px-3 py-2 bg-black/40 border border-purple-800/50 rounded-lg text-sm"
            >
              {variants.map((v) => (
                <option key={v.duration} value={v.duration}>
                  {v.duration} — ${v.price?.toLocaleString("es-CO")}{" "}
                  {v.stock <= 0 ? "(Agotado)" : `(${v.stock} disp.)`}
                </option>
              ))}
            </select>

            <div className="flex items-center justify-between">
              <span className="text-xl font-bold text-green-400">
                ${selected?.price?.toLocaleString("es-CO") || 0}
              </span>
              <button
                onClick={handleAdd}
                disabled={!selected || selected.stock <= 0}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition"
              >
                {selected?.stock <= 0 ? "Agotado" : "Agregar"}
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-500">Sin variantes disponibles</p>
        )}
      </div>
    </div>
  );
}

// ==================== PRODUCTOS ====================
function ProductsPage() {
  const { products, categories } = useApp();
  const [filter, setFilter] = useState("Todos");

  const filtered =
    filter === "Todos"
      ? products
      : products.filter((p) => p.category === filter);

  return (
    <main className="max-w-7xl mx-auto px-4 py-10">
      <h2 className="text-3xl font-bold mb-8">Todos los Productos</h2>

      <div className="flex flex-wrap gap-2 mb-8">
        <button
          onClick={() => setFilter("Todos")}
          className={`px-4 py-2 rounded-full text-sm transition ${
            filter === "Todos" ? "bg-purple-600 text-white" : "bg-gray-800 hover:bg-gray-700"
          }`}
        >
          Todos
        </button>
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`px-4 py-2 rounded-full text-sm transition ${
              filter === c ? "bg-purple-600 text-white" : "bg-gray-800 hover:bg-gray-700"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-gray-500 py-20">
          No hay productos en esta categoría.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </main>
  );
}

// ==================== CARRITO ====================
function CartPage() {
  const { cart, removeFromCart, updateQty, cartTotal, user, userData, clearCart, setUserData, products } = useApp();
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");

  const handleBuy = async () => {
    if (!user) return navigate("/login");
    if (cart.length === 0) return;

    if ((userData?.balance || 0) < cartTotal) {
      setMessage("Saldo insuficiente. Ve a Recargar Saldo.");
      return;
    }

    setProcessing(true);
    setMessage("");

    try {
      // Verificar stock y descontar
      for (const item of cart) {
        const product = products.find((p) => p.id === item.productId);
        if (!product) throw new Error(`Producto ${item.name} no encontrado`);

        const variant = (product.variants || []).find(
          (v) => v.duration === item.duration
        );
        if (!variant || variant.stock < item.qty) {
          throw new Error(`Stock insuficiente de ${item.name} (${item.duration})`);
        }
      }

      // Actualizar stock de cada variante
      for (const item of cart) {
        const productRef = doc(db, "products", item.productId);
        const productSnap = await getDoc(productRef);
        if (productSnap.exists()) {
          const data = productSnap.data();
          const updatedVariants = (data.variants || []).map((v) => {
            if (v.duration === item.duration) {
              return { ...v, stock: v.stock - item.qty };
            }
            return v;
          });
          await updateDoc(productRef, { variants: updatedVariants });
        }
      }

      // Descontar saldo
      const newBalance = userData.balance - cartTotal;
      await updateDoc(doc(db, "users", user.uid), { balance: newBalance });
      setUserData({ ...userData, balance: newBalance });

      // Guardar pedido
      await addDoc(collection(db, "orders"), {
        userId: user.uid,
        userEmail: user.email,
        items: cart,
        total: cartTotal,
        createdAt: serverTimestamp(),
      });

      clearCart();
      setMessage("¡Compra realizada con éxito!");
    } catch (err) {
      setMessage("Error: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  if (cart.length === 0) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-20 text-center">
        <p className="text-2xl text-gray-400 mb-6">Tu carrito está vacío</p>
        <Link
          to="/productos"
          className="inline-block px-6 py-3 bg-purple-600 rounded-lg hover:bg-purple-500 transition"
        >
          Ver productos
        </Link>
        {message && <p className="mt-6 text-green-400 font-medium">{message}</p>}
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <h2 className="text-3xl font-bold mb-8">Carrito de Compras</h2>

      <div className="space-y-4 mb-8">
        {cart.map((item) => (
          <div
            key={`${item.productId}-${item.duration}`}
            className="flex items-center gap-4 bg-[#12121a] border border-purple-900/40 rounded-xl p-4"
          >
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-black/40 flex-shrink-0">
              {item.imageUrl ? (
                <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl">📦</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium truncate">{item.name}</h4>
              <p className="text-sm text-purple-400">{item.duration}</p>
              {item.renewable && (
                <span className="text-xs text-green-400">Renovable</span>
              )}
              <p className="text-green-400 font-bold">
                ${item.price?.toLocaleString("es-CO")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateQty(item.productId, item.duration, item.qty - 1)}
                className="w-8 h-8 bg-gray-800 rounded-lg"
              >
                -
              </button>
              <span className="w-8 text-center">{item.qty}</span>
              <button
                onClick={() => updateQty(item.productId, item.duration, item.qty + 1)}
                className="w-8 h-8 bg-gray-800 rounded-lg"
              >
                +
              </button>
            </div>
            <button
              onClick={() => removeFromCart(item.productId, item.duration)}
              className="text-red-400 hover:text-red-300 ml-2"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="bg-[#12121a] border border-purple-900/40 rounded-xl p-6">
        <div className="flex justify-between text-xl font-bold mb-4">
          <span>Total</span>
          <span className="text-green-400">
            ${cartTotal.toLocaleString("es-CO")}
          </span>
        </div>

        {user && (
          <p className="text-sm text-gray-400 mb-4">
            Tu saldo actual:{" "}
            <span className="text-green-400 font-medium">
              ${userData?.balance?.toLocaleString("es-CO") || 0}
            </span>
          </p>
        )}

        <button
          onClick={handleBuy}
          disabled={processing}
          className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-500 rounded-xl font-bold text-lg hover:opacity-90 transition disabled:opacity-50"
        >
          {processing ? "Procesando..." : user ? "Comprar ahora" : "Inicia sesión para comprar"}
        </button>

        {message && (
          <p
            className={`mt-4 text-center font-medium ${
              message.includes("éxito") ? "text-green-400" : "text-red-400"
            }`}
          >
            {message}
          </p>
        )}
      </div>
    </main>
  );
}

// ==================== RECARGAR SALDO ====================
function RechargePage() {
  const { user, siteSettings } = useApp();
  const [amount, setAmount] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  if (!user) {
    return (
      <main className="max-w-xl mx-auto px-4 py-20 text-center">
        <p className="text-xl text-gray-400 mb-6">Debes iniciar sesión para recargar saldo</p>
        <Link to="/login" className="inline-block px-6 py-3 bg-purple-600 rounded-lg">
          Iniciar sesión
        </Link>
      </main>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return setMessage("Ingresa un monto válido");
    if (!proofUrl) return setMessage("Debes pegar el link del comprobante");

    setLoading(true);
    setMessage("");
    try {
      await addDoc(collection(db, "recharges"), {
        userId: user.uid,
        userEmail: user.email,
        amount: Number(amount),
        proofUrl,
        note,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      setMessage("¡Solicitud enviada! El administrador revisará tu pago.");
      setAmount("");
      setProofUrl("");
      setNote("");
    } catch (err) {
      setMessage("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <h2 className="text-3xl font-bold mb-2">Recargar Saldo</h2>
      <p className="text-gray-400 mb-8">Realiza el pago y sube el comprobante</p>

      <div className="bg-[#12121a] border border-purple-900/40 rounded-2xl p-6 mb-8 text-center">
        <p className="text-sm text-gray-400 mb-2">Paga a través de Nequi</p>
        <p className="text-2xl font-bold text-white mb-1">
          {siteSettings.nequiName || "Juan Pinto"}
        </p>
        <p className="text-xl text-purple-400 font-mono mb-4">
          {siteSettings.nequiNumber || "3216401956"}
        </p>
        {siteSettings.qrUrl && (
          <img
            src={siteSettings.qrUrl}
            alt="QR Nequi"
            className="mx-auto w-56 h-56 object-contain bg-white rounded-xl p-2"
          />
        )}
        <p className="text-xs text-gray-500 mt-3">Escanea el QR o usa el número de Nequi</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-[#12121a] border border-purple-900/40 rounded-2xl p-6 space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Monto que enviaste</label>
          <input
            type="number"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Ej: 20000"
            className="w-full px-4 py-3 bg-black/40 border border-purple-800/50 rounded-xl focus:outline-none focus:border-purple-500"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Link del comprobante</label>
          <input
            type="url"
            required
            value={proofUrl}
            onChange={(e) => setProofUrl(e.target.value)}
            placeholder="https://postimg.cc/xxxxx"
            className="w-full px-4 py-3 bg-black/40 border border-purple-800/50 rounded-xl focus:outline-none focus:border-purple-500"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Nota (opcional)</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ej: Pago desde el número 300..."
            className="w-full px-4 py-3 bg-black/40 border border-purple-800/50 rounded-xl focus:outline-none focus:border-purple-500"
          />
        </div>
        {message && (
          <p className={`text-sm ${message.includes("enviada") ? "text-green-400" : "text-red-400"}`}>
            {message}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-500 rounded-xl font-bold hover:opacity-90 transition disabled:opacity-50"
        >
          {loading ? "Enviando..." : "Enviar solicitud de recarga"}
        </button>
      </form>
    </main>
  );
}

// ==================== AUTH ====================
function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/");
    } catch {
      setError("Correo o contraseña incorrectos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthForm
      title="Iniciar Sesión"
      onSubmit={handleSubmit}
      email={email}
      setEmail={setEmail}
      password={password}
      setPassword={setPassword}
      error={error}
      loading={loading}
      buttonText="Entrar"
      footer={
        <>
          <Link to="/registro" className="text-purple-400 hover:underline">
            ¿No tienes cuenta? Regístrate
          </Link>
          <br />
          <Link to="/recuperar" className="text-purple-400 hover:underline text-sm">
            ¿Olvidaste tu contraseña?
          </Link>
        </>
      }
    />
  );
}

function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) return setError("La contraseña debe tener al menos 6 caracteres");
    setLoading(true);
    setError("");
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, "users", cred.user.uid), {
        email,
        balance: 0,
        role: "user",
        createdAt: serverTimestamp(),
      });
      navigate("/");
    } catch (err) {
      setError(err.message.includes("email-already") ? "Este correo ya está registrado" : err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthForm
      title="Crear Cuenta"
      onSubmit={handleSubmit}
      email={email}
      setEmail={setEmail}
      password={password}
      setPassword={setPassword}
      error={error}
      loading={loading}
      buttonText="Registrarse"
      footer={
        <Link to="/login" className="text-purple-400 hover:underline">
          ¿Ya tienes cuenta? Inicia sesión
        </Link>
      }
    />
  );
}

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("Te enviamos un correo para restablecer tu contraseña.");
    } catch {
      setError("No se pudo enviar el correo. Verifica el email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[#12121a] border border-purple-900/50 rounded-2xl p-8">
        <h2 className="text-2xl font-bold mb-6 text-center">Recuperar Contraseña</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            className="w-full px-4 py-3 bg-black/40 border border-purple-800/50 rounded-xl focus:outline-none focus:border-purple-500"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          {message && <p className="text-green-400 text-sm">{message}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-500 rounded-xl font-bold hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? "Enviando..." : "Enviar correo de recuperación"}
          </button>
        </form>
        <p className="mt-6 text-center">
          <Link to="/login" className="text-purple-400 hover:underline text-sm">
            Volver al login
          </Link>
        </p>
      </div>
    </div>
  );
}

function AuthForm({ title, onSubmit, email, setEmail, password, setPassword, error, loading, buttonText, footer }) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[#12121a] border border-purple-900/50 rounded-2xl p-8">
        <h2 className="text-2xl font-bold mb-6 text-center">{title}</h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            className="w-full px-4 py-3 bg-black/40 border border-purple-800/50 rounded-xl focus:outline-none focus:border-purple-500"
          />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-4 py-3 bg-black/40 border border-purple-800/50 rounded-xl focus:outline-none focus:border-purple-500"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-500 rounded-xl font-bold hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? "Cargando..." : buttonText}
          </button>
        </form>
        <p className="mt-6 text-center text-sm">{footer}</p>
      </div>
    </div>
  );
}

// ==================== ADMIN PANEL ====================
function AdminPanel() {
  const [tab, setTab] = useState("products");

  return (
    <main className="max-w-7xl mx-auto px-4 py-10">
      <h2 className="text-3xl font-bold mb-8">Panel de Administración</h2>
      <div className="flex flex-wrap gap-2 mb-8 border-b border-purple-900/50 pb-4">
        {[
          { id: "products", label: "Productos" },
          { id: "categories", label: "Categorías" },
          { id: "recharges", label: "Recargas" },
          { id: "users", label: "Usuarios y Saldos" },
          { id: "settings", label: "Configuración" },
          { id: "orders", label: "Pedidos" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-2 rounded-lg font-medium transition ${
              tab === t.id ? "bg-purple-600 text-white" : "bg-gray-800 hover:bg-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "products" && <AdminProducts />}
      {tab === "categories" && <AdminCategories />}
      {tab === "recharges" && <AdminRecharges />}
      {tab === "users" && <AdminUsers />}
      {tab === "settings" && <AdminSettings />}
      {tab === "orders" && <AdminOrders />}
    </main>
  );
}

// ---------- Admin Productos con Variantes ----------
function AdminProducts() {
  const { categories } = useApp();
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: categories[0] || "",
    imageUrl: "",
    renewable: false,
    active: true,
    variants: [{ duration: "30 días", price: "", stock: "" }],
  });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "products"), orderBy("createdAt", "desc")),
      (snap) => {
        setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }
    );
    return () => unsub();
  }, []);

  const addVariant = () => {
    setForm({
      ...form,
      variants: [...form.variants, { duration: "", price: "", stock: "" }],
    });
  };

  const updateVariant = (index, field, value) => {
    const updated = [...form.variants];
    updated[index][field] = value;
    setForm({ ...form, variants: updated });
  };

  const removeVariant = (index) => {
    if (form.variants.length <= 1) return;
    setForm({
      ...form,
      variants: form.variants.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const cleanVariants = form.variants
      .filter((v) => v.duration && v.price !== "")
      .map((v) => ({
        duration: v.duration.trim(),
        price: Number(v.price),
        stock: Number(v.stock) || 0,
      }));

    if (cleanVariants.length === 0) {
      alert("Debes agregar al menos una variante con duración y precio");
      return;
    }

    const data = {
      name: form.name,
      description: form.description,
      category: form.category,
      imageUrl: form.imageUrl,
      renewable: form.renewable,
      active: form.active,
      variants: cleanVariants,
      createdAt: serverTimestamp(),
    };

    if (editingId) {
      await updateDoc(doc(db, "products", editingId), data);
    } else {
      await addDoc(collection(db, "products"), data);
    }

    setForm({
      name: "",
      description: "",
      category: categories[0] || "",
      imageUrl: "",
      renewable: false,
      active: true,
      variants: [{ duration: "30 días", price: "", stock: "" }],
    });
    setEditingId(null);
  };

  const startEdit = (p) => {
    setForm({
      name: p.name,
      description: p.description || "",
      category: p.category || categories[0],
      imageUrl: p.imageUrl || "",
      renewable: p.renewable || false,
      active: p.active !== false,
      variants:
        p.variants && p.variants.length > 0
          ? p.variants.map((v) => ({
              duration: v.duration,
              price: v.price,
              stock: v.stock,
            }))
          : [{ duration: "30 días", price: "", stock: "" }],
    });
    setEditingId(p.id);
  };

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      {/* Formulario */}
      <div className="bg-[#12121a] border border-purple-900/40 rounded-2xl p-6">
        <h3 className="text-xl font-bold mb-4">
          {editingId ? "Editar Producto" : "Agregar Producto"}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            required
            placeholder="Nombre del producto"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-4 py-3 bg-black/40 border border-purple-800/50 rounded-xl"
          />
          <textarea
            placeholder="Descripción"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-4 py-3 bg-black/40 border border-purple-800/50 rounded-xl h-20"
          />
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full px-4 py-3 bg-black/40 border border-purple-800/50 rounded-xl"
          >
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <input
            type="url"
            placeholder="Link de la imagen"
            value={form.imageUrl}
            onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
            className="w-full px-4 py-3 bg-black/40 border border-purple-800/50 rounded-xl"
          />

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.renewable}
              onChange={(e) => setForm({ ...form, renewable: e.target.checked })}
            />
            Es renovable
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Activo (visible en la tienda)
          </label>

          {/* Variantes */}
          <div className="border-t border-purple-900/50 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-purple-400">Variantes de duración</h4>
              <button
                type="button"
                onClick={addVariant}
                className="text-sm px-3 py-1 bg-purple-600 rounded-lg"
              >
                + Agregar
              </button>
            </div>

            {form.variants.map((v, index) => (
              <div key={index} className="flex gap-2 mb-3 items-center">
                <input
                  placeholder="Duración (ej: 30 días)"
                  value={v.duration}
                  onChange={(e) => updateVariant(index, "duration", e.target.value)}
                  className="flex-1 px-3 py-2 bg-black/40 border border-purple-800/50 rounded-lg text-sm"
                />
                <input
                  type="number"
                  placeholder="Precio"
                  value={v.price}
                  onChange={(e) => updateVariant(index, "price", e.target.value)}
                  className="w-24 px-3 py-2 bg-black/40 border border-purple-800/50 rounded-lg text-sm"
                />
                <input
                  type="number"
                  placeholder="Stock"
                  value={v.stock}
                  onChange={(e) => updateVariant(index, "stock", e.target.value)}
                  className="w-20 px-3 py-2 bg-black/40 border border-purple-800/50 rounded-lg text-sm"
                />
                {form.variants.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeVariant(index)}
                    className="text-red-400 text-sm"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold"
            >
              {editingId ? "Guardar cambios" : "Agregar producto"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm({
                    name: "",
                    description: "",
                    category: categories[0] || "",
                    imageUrl: "",
                    renewable: false,
                    active: true,
                    variants: [{ duration: "30 días", price: "", stock: "" }],
                  });
                }}
                className="px-4 py-3 bg-gray-700 rounded-xl"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Lista de productos */}
      <div className="space-y-3 max-h-[80vh] overflow-y-auto">
        {products.map((p) => (
          <div
            key={p.id}
            className="bg-[#12121a] border border-purple-900/40 rounded-xl p-4"
          >
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-lg overflow-hidden bg-black/40 flex-shrink-0">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">📦</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium truncate">{p.name}</h4>
                  {p.renewable && (
                    <span className="text-xs bg-green-600/30 text-green-400 px-2 py-0.5 rounded">
                      Renovable
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-400">{p.category}</p>
                <div className="mt-2 space-y-1">
                  {(p.variants || []).map((v, i) => (
                    <p key={i} className="text-xs text-gray-300">
                      {v.duration}: ${v.price?.toLocaleString("es-CO")} — Stock: {v.stock}
                    </p>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => startEdit(p)}
                  className="px-3 py-1 bg-blue-600/80 rounded-lg text-sm"
                >
                  Editar
                </button>
                <button
                  onClick={() => {
                    if (confirm("¿Eliminar este producto?")) {
                      deleteDoc(doc(db, "products", p.id));
                    }
                  }}
                  className="px-3 py-1 bg-red-600/80 rounded-lg text-sm"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminCategories() {
  const { categories } = useApp();
  const [list, setList] = useState(categories);
  const [newCat, setNewCat] = useState("");

  useEffect(() => setList(categories), [categories]);

  const save = async (newList) => {
    await setDoc(doc(db, "settings", "categories"), { list: newList });
    setList(newList);
  };

  return (
    <div className="max-w-xl bg-[#12121a] border border-purple-900/40 rounded-2xl p-6">
      <h3 className="text-xl font-bold mb-6">Administrar Categorías</h3>
      <div className="flex gap-2 mb-6">
        <input
          value={newCat}
          onChange={(e) => setNewCat(e.target.value)}
          placeholder="Nueva categoría"
          className="flex-1 px-4 py-3 bg-black/40 border border-purple-800/50 rounded-xl"
        />
        <button
          onClick={() => {
            if (newCat.trim()) {
              save([...list, newCat.trim()]);
              setNewCat("");
            }
          }}
          className="px-5 py-3 bg-purple-600 rounded-xl"
        >
          Agregar
        </button>
      </div>
      <div className="space-y-2">
        {list.map((cat) => (
          <div
            key={cat}
            className="flex items-center justify-between bg-black/30 px-4 py-3 rounded-xl"
          >
            <span>{cat}</span>
            <button
              onClick={() => save(list.filter((c) => c !== cat))}
              className="text-red-400 text-sm"
            >
              Eliminar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminRecharges() {
  const [recharges, setRecharges] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "recharges"), orderBy("createdAt", "desc")),
      (snap) => {
        setRecharges(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }
    );
    return () => unsub();
  }, []);

  const approve = async (r) => {
    if (!confirm(`¿Aprobar recarga de $${r.amount.toLocaleString("es-CO")} a ${r.userEmail}?`)) return;
    const userRef = doc(db, "users", r.userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const currentBalance = userSnap.data().balance || 0;
      await updateDoc(userRef, { balance: currentBalance + r.amount });
    }
    await updateDoc(doc(db, "recharges", r.id), {
      status: "approved",
      approvedAt: serverTimestamp(),
    });
  };

  const reject = async (id) => {
    if (confirm("¿Rechazar esta solicitud?")) {
      await updateDoc(doc(db, "recharges", id), { status: "rejected" });
    }
  };

  return (
    <div className="space-y-4">
      {recharges.length === 0 ? (
        <p className="text-gray-500">No hay solicitudes de recarga.</p>
      ) : (
        recharges.map((r) => (
          <div key={r.id} className="bg-[#12121a] border border-purple-900/40 rounded-xl p-5">
            <div className="flex flex-wrap justify-between gap-3 mb-3">
              <div>
                <p className="font-medium">{r.userEmail}</p>
                <p className="text-sm text-gray-400">
                  {r.createdAt?.toDate?.().toLocaleString("es-CO") || "—"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-green-400">
                  ${r.amount?.toLocaleString("es-CO")}
                </p>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    r.status === "pending"
                      ? "bg-yellow-600/30 text-yellow-400"
                      : r.status === "approved"
                      ? "bg-green-600/30 text-green-400"
                      : "bg-red-600/30 text-red-400"
                  }`}
                >
                  {r.status === "pending"
                    ? "Pendiente"
                    : r.status === "approved"
                    ? "Aprobada"
                    : "Rechazada"}
                </span>
              </div>
            </div>
            {r.note && <p className="text-sm text-gray-400 mb-2">Nota: {r.note}</p>}
            {r.proofUrl && (
              <a
                href={r.proofUrl}
                target="_blank"
                rel="noreferrer"
                className="text-purple-400 text-sm underline"
              >
                Ver comprobante →
              </a>
            )}
            {r.status === "pending" && (
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => approve(r)}
                  className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium"
                >
                  Aprobar y sumar saldo
                </button>
                <button
                  onClick={() => reject(r.id)}
                  className="px-4 py-2 bg-red-600/80 hover:bg-red-500 rounded-lg text-sm"
                >
                  Rechazar
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [amount, setAmount] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const updateBalance = async (uid, newBalance) => {
    await updateDoc(doc(db, "users", uid), { balance: Number(newBalance) });
    setSelected(null);
    setAmount("");
  };

  return (
    <div className="space-y-3">
      {users.map((u) => (
        <div
          key={u.id}
          className="flex flex-wrap items-center gap-4 bg-[#12121a] border border-purple-900/40 rounded-xl p-4"
        >
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{u.email}</p>
            <p className="text-sm text-gray-400">
              Rol: {u.role || "user"} · Saldo:{" "}
              <span className="text-green-400 font-bold">
                ${u.balance?.toLocaleString("es-CO") || 0}
              </span>
            </p>
          </div>
          {selected === u.id ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-32 px-3 py-2 bg-black/40 border border-purple-800/50 rounded-lg"
              />
              <button
                onClick={() => updateBalance(u.id, amount)}
                className="px-3 py-2 bg-green-600 rounded-lg text-sm"
              >
                Guardar
              </button>
              <button
                onClick={() => setSelected(null)}
                className="px-3 py-2 bg-gray-700 rounded-lg text-sm"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setSelected(u.id);
                setAmount(u.balance || 0);
              }}
              className="px-3 py-2 bg-purple-600 rounded-lg text-sm"
            >
              Cambiar saldo
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function AdminSettings() {
  const { siteSettings } = useApp();
  const [form, setForm] = useState({
    name: "",
    slogan: "",
    logoUrl: "",
    nequiNumber: "",
    nequiName: "",
    qrUrl: "",
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setForm({
      name: siteSettings.name || "",
      slogan: siteSettings.slogan || "",
      logoUrl: siteSettings.logoUrl || "",
      nequiNumber: siteSettings.nequiNumber || "3216401956",
      nequiName: siteSettings.nequiName || "Juan Pinto",
      qrUrl: siteSettings.qrUrl || "",
    });
  }, [siteSettings]);

  const handleSave = async (e) => {
    e.preventDefault();
    await setDoc(doc(db, "settings", "site"), form);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="max-w-xl bg-[#12121a] border border-purple-900/40 rounded-2xl p-6">
      <h3 className="text-xl font-bold mb-6">Configuración del Sitio</h3>
      <form onSubmit={handleSave} className="space-y-5">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Nombre de la página</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-4 py-3 bg-black/40 border border-purple-800/50 rounded-xl"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Slogan</label>
          <input
            value={form.slogan}
            onChange={(e) => setForm({ ...form, slogan: e.target.value })}
            className="w-full px-4 py-3 bg-black/40 border border-purple-800/50 rounded-xl"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Link del Logo</label>
          <input
            type="url"
            value={form.logoUrl}
            onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
            className="w-full px-4 py-3 bg-black/40 border border-purple-800/50 rounded-xl"
          />
        </div>

        <hr className="border-purple-900/50" />
        <h4 className="font-bold text-purple-400">Medios de Pago (Nequi)</h4>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Nombre del titular</label>
          <input
            value={form.nequiName}
            onChange={(e) => setForm({ ...form, nequiName: e.target.value })}
            className="w-full px-4 py-3 bg-black/40 border border-purple-800/50 rounded-xl"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Número de Nequi / Llave</label>
          <input
            value={form.nequiNumber}
            onChange={(e) => setForm({ ...form, nequiNumber: e.target.value })}
            className="w-full px-4 py-3 bg-black/40 border border-purple-800/50 rounded-xl"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Link del QR</label>
          <input
            type="url"
            value={form.qrUrl}
            onChange={(e) => setForm({ ...form, qrUrl: e.target.value })}
            className="w-full px-4 py-3 bg-black/40 border border-purple-800/50 rounded-xl"
          />
          {form.qrUrl && (
            <img
              src={form.qrUrl}
              alt="QR"
              className="mt-3 w-32 h-32 object-contain bg-white rounded-lg p-1"
            />
          )}
        </div>

        <button
          type="submit"
          className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-500 rounded-xl font-bold"
        >
          Guardar cambios
        </button>
        {saved && <p className="text-green-400 text-center">¡Guardado correctamente!</p>}
      </form>
    </div>
  );
}

function AdminOrders() {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "orders"), orderBy("createdAt", "desc")),
      (snap) => {
        setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }
    );
    return () => unsub();
  }, []);

  return (
    <div className="space-y-4">
      {orders.length === 0 ? (
        <p className="text-gray-500">Aún no hay pedidos.</p>
      ) : (
        orders.map((o) => (
          <div key={o.id} className="bg-[#12121a] border border-purple-900/40 rounded-xl p-5">
            <div className="flex justify-between mb-3">
              <div>
                <p className="font-medium">{o.userEmail}</p>
                <p className="text-sm text-gray-400">
                  {o.createdAt?.toDate?.().toLocaleString("es-CO") || "—"}
                </p>
              </div>
              <p className="text-xl font-bold text-green-400">
                ${o.total?.toLocaleString("es-CO")}
              </p>
            </div>
            <div className="text-sm text-gray-300 space-y-1">
              {o.items?.map((item, i) => (
                <p key={i}>
                  {item.qty}x {item.name} ({item.duration}) — $
                  {item.price?.toLocaleString("es-CO")}
                </p>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}