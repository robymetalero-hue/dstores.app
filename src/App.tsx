import React, { useState, useEffect } from 'react';
import { 
  collection, 
  doc, 
  addDoc,
  setDoc,
  updateDoc, 
  deleteDoc, 
  serverTimestamp, 
  query, 
  orderBy, 
  onSnapshot 
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  User 
} from 'firebase/auth';
import { 
  db, 
  auth, 
  googleProvider, 
  handleFirestoreError, 
  OperationType, 
  testConnection 
} from './firebase';
import { Product, ProductFormInput } from './types';
import { 
  Package, 
  Plus, 
  Trash2, 
  Edit, 
  Search, 
  Filter, 
  LogIn, 
  LogOut, 
  User as UserIcon, 
  TrendingUp, 
  Layers, 
  AlertTriangle, 
  CheckCircle2, 
  Tag, 
  DollarSign, 
  Database, 
  Sparkles, 
  RefreshCw, 
  X,
  Info,
  ShieldAlert,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const CATEGORIES = [
  'Tecnología',
  'Moda y Estilo',
  'Hogar y Cocina',
  'Deportes y Fitness',
  'Libros y Papelería',
  'Herramientas',
  'Otros'
];

interface FirebaseErrorDetail {
  error: string;
  operationType: string;
  path: string | null;
  authInfo: any;
}

export default function App() {
  // Authentication states
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Core Product data states
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);

  // Catalog Navigation / Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [stockFilter, setStockFilter] = useState<'all' | 'instock' | 'lowstock'>('all');
  const [priceRange, setPriceRange] = useState({ min: 0, max: 10000 });

  // Form Modals / UI States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formInput, setFormInput] = useState<ProductFormInput>({
    name: '',
    description: '',
    price: 0,
    stock: 0,
    category: 'Tecnología',
    imageUrl: ''
  });

  // Action feedback & Error alerts
  const [diagnosticError, setDiagnosticError] = useState<FirebaseErrorDetail | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Trigger Auth changed listener & Verify basic Connection
  useEffect(() => {
    testConnection();

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        setIsAdmin(user.email === 'robymetalero@gmail.com');
      } else {
        setIsAdmin(false);
      }
      setAuthLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  // Listen to Firestore Products
  useEffect(() => {
    const productsRef = collection(db, 'products');
    const q = query(productsRef, orderBy('createdAt', 'desc'));

    const unsubscribeProducts = onSnapshot(q, 
      (snapshot) => {
        const loadedProducts: Product[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          loadedProducts.push({
            id: docSnap.id,
            name: data.name || '',
            description: data.description || '',
            price: Number(data.price) || 0,
            stock: Number(data.stock) || 0,
            category: data.category || 'Otros',
            imageUrl: data.imageUrl || '',
            createdBy: data.createdBy || '',
            creatorEmail: data.creatorEmail || '',
            createdAt: data.createdAt,
            updatedAt: data.updatedAt
          });
        });
        setProducts(loadedProducts);
        setProductsLoading(false);
      },
      (error) => {
        // Log snapshot listener error in requested format
        setProductsLoading(false);
        try {
          handleFirestoreError(error, OperationType.GET, 'products');
        } catch (wrappedError: any) {
          try {
            setDiagnosticError(JSON.parse(wrappedError.message));
          } catch {
            setDiagnosticError({
              error: error.message,
              operationType: 'get',
              path: 'products',
              authInfo: null
            });
          }
        }
      }
    );

    return () => unsubscribeProducts();
  }, []);

  // Quick toast notification timer
  useEffect(() => {
    if (successToast) {
      const timer = setTimeout(() => setSuccessToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successToast]);

  // Auth Functions
  const handleLogin = async () => {
    try {
      setDiagnosticError(null);
      await signInWithPopup(auth, googleProvider);
      setSuccessToast('¡Sesión iniciada con éxito!');
    } catch (err: any) {
      console.error('Login error:', err);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setSuccessToast('Sesión cerrada correctamente.');
    } catch (err: any) {
      console.error('Logout error:', err);
    }
  };

  // Helper date formatter
  const formatTimestamp = (ts: any) => {
    if (!ts) return 'Pendiente';
    if (typeof ts.toDate === 'function') {
      return ts.toDate().toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    if (ts instanceof Date) {
      return ts.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    const d = new Date(ts);
    return isNaN(d.getTime()) ? 'Reciente' : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Handle product form changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormInput(prev => ({
      ...prev,
      [name]: name === 'price' || name === 'stock' ? Number(value) : value
    }));
  };

  // Filter products based on search criteria
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          product.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          product.creatorEmail.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'Todos' || product.category === selectedCategory;
    
    let matchesStock = true;
    if (stockFilter === 'instock') matchesStock = product.stock > 0;
    else if (stockFilter === 'lowstock') matchesStock = product.stock <= 5;

    const matchesPrice = product.price >= priceRange.min && product.price <= priceRange.max;

    return matchesSearch && matchesCategory && matchesStock && matchesPrice;
  });

  // Create or Update Product handlers
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      alert('Debes iniciar sesión con Google para poder crear o editar productos.');
      return;
    }

    setIsSubmitting(true);
    setDiagnosticError(null);

    const productPayload = {
      name: formInput.name.trim(),
      description: formInput.description.trim(),
      price: Number(formInput.price),
      stock: Number(formInput.stock),
      category: formInput.category,
      imageUrl: formInput.imageUrl.trim() || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&auto=format&fit=crop&q=60',
      createdBy: currentUser.uid,
      creatorEmail: currentUser.email || 'anonimo@test.com',
      updatedAt: serverTimestamp()
    };

    try {
      if (editingId) {
        // Edit mode
        const originalProduct = products.find(p => p.id === editingId);
        if (!originalProduct) throw new Error('Producto no encontrado');

        // Check ownership upfront to explain to user clearly
        const hasPermission = isAdmin || originalProduct.createdBy === currentUser.uid;
        if (!hasPermission) {
          throw new Error('Permisos insuficientes: No puedes modificar productos creados por otros usuarios.');
        }

        const productDocRef = doc(db, 'products', editingId);
        await updateDoc(productDocRef, {
          name: productPayload.name,
          description: productPayload.description,
          price: productPayload.price,
          stock: productPayload.stock,
          category: productPayload.category,
          imageUrl: productPayload.imageUrl,
          updatedAt: serverTimestamp()
        });
        
        setSuccessToast('¡Producto actualizado correctamente!');
      } else {
        // Insert mode
        const newProductRef = doc(collection(db, 'products'));
        // Enforce strict model rules
        await setDoc(newProductRef, {
          ...productPayload,
          createdAt: serverTimestamp()
        });

        setSuccessToast('¡Nuevo producto agregado con éxito!');
      }

      // Reset Form State
      setIsFormOpen(false);
      setEditingId(null);
      setFormInput({
        name: '',
        description: '',
        price: 0,
        stock: 0,
        category: 'Tecnología',
        imageUrl: ''
      });

    } catch (error: any) {
      console.error('Error writing product:', error);
      try {
        handleFirestoreError(
          error, 
          editingId ? OperationType.UPDATE : OperationType.CREATE, 
          editingId ? `products/${editingId}` : 'products'
        );
      } catch (wrappedError: any) {
        try {
          setDiagnosticError(JSON.parse(wrappedError.message));
        } catch {
          setDiagnosticError({
            error: error.message,
            operationType: editingId ? 'update' : 'create',
            path: editingId ? `products/${editingId}` : 'products',
            authInfo: {
              userId: currentUser.uid,
              email: currentUser.email,
              emailVerified: currentUser.emailVerified
            }
          });
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Product Handler
  const handleDeleteProduct = async (id: string) => {
    if (!currentUser) {
      alert('Debes iniciar sesión con Google para poder eliminar productos.');
      return;
    }

    const originalProduct = products.find(p => p.id === id);
    if (!originalProduct) return;

    if (!confirm(`¿Estás seguro de que quieres eliminar el producto: "${originalProduct.name}"?`)) {
      return;
    }

    setDiagnosticError(null);

    // Dynamic Permission Check
    const hasPermission = isAdmin || originalProduct.createdBy === currentUser.uid;
    if (!hasPermission) {
      alert('Permisos insuficientes: No eres el creador de este producto ni tienes rol de Administrador.');
      return;
    }

    try {
      await deleteDoc(doc(db, 'products', id));
      setSuccessToast('¡Se ha eliminado el producto correctamente!');
    } catch (error: any) {
      console.error('Error deleting product:', error);
      try {
        handleFirestoreError(error, OperationType.DELETE, `products/${id}`);
      } catch (wrappedError: any) {
        try {
          setDiagnosticError(JSON.parse(wrappedError.message));
        } catch {
          setDiagnosticError({
            error: error.message,
            operationType: 'delete',
            path: `products/${id}`,
            authInfo: {
              userId: currentUser.uid,
              email: currentUser.email,
              emailVerified: currentUser.emailVerified
            }
          });
        }
      }
    }
  };

  // Set form fields for editing
  const openEditModal = (product: Product) => {
    setEditingId(product.id);
    setFormInput({
      name: product.name,
      description: product.description,
      price: product.price,
      stock: product.stock,
      category: product.category,
      imageUrl: product.imageUrl || ''
    });
    setDiagnosticError(null);
    setIsFormOpen(true);
  };

  // Seed sample catalog database handler
  const handleSeedDatabase = async () => {
    if (!currentUser) {
      alert('Inicia sesión con Google antes de inicializar la semilla de productos.');
      return;
    }

    setDiagnosticError(null);
    setIsSubmitting(true);

    const mockupItems = [
      {
        name: 'iPhone 15 Pro Max Titanium',
        description: 'Smartphone de alta gama con chasis de titanio de grado aeroespacial, chip A17 Pro ultra veloz y zoom óptico 5x.',
        price: 1399,
        stock: 12,
        category: 'Tecnología',
        imageUrl: 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=500&auto=format&fit=crop&q=80'
      },
      {
        name: 'Silla Ergonómica Pro-Calm',
        description: 'Silla de escritorio con soporte lumbar activo ajustable 3D, malla respirable premium y reposabrazos acolchados.',
        price: 249,
        stock: 3,
        category: 'Hogar y Cocina',
        imageUrl: 'https://images.unsplash.com/photo-1580481072645-022f9a6dbf27?w=500&auto=format&fit=crop&q=80'
      },
      {
        name: 'Mochila de Cuero Artisan Noir',
        description: 'Mochila de cuero auténtico curtido al vegetal, cosida a mano con compartimiento acolchado para portátil de 16".',
        price: 180,
        stock: 22,
        category: 'Moda y Estilo',
        imageUrl: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=500&auto=format&fit=crop&q=80'
      },
      {
        name: 'Teclado Mecánico Retro RK84',
        description: 'Teclado compacto de formato 75% con switches amarillos pre-lubricados, teclas PBT duraderas y retroiluminación RGB.',
        price: 85,
        stock: 0,
        category: 'Tecnología',
        imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500&auto=format&fit=crop&q=80'
      }
    ];

    try {
      let counter = 0;
      for (const item of mockupItems) {
        const docRef = doc(collection(db, 'products'));
        await setDoc(docRef, {
          ...item,
          createdBy: currentUser.uid,
          creatorEmail: currentUser.email || 'anonimo@test.com',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        counter++;
      }
      setSuccessToast(`¡Se agregaron con éxito ${counter} productos de prueba!`);
    } catch (error: any) {
      console.error('Error seeding data:', error);
      try {
        handleFirestoreError(error, OperationType.CREATE, 'products/seed');
      } catch (wrappedError: any) {
        try {
          setDiagnosticError(JSON.parse(wrappedError.message));
        } catch {
          setDiagnosticError({
            error: error.message,
            operationType: 'create',
            path: 'products/seed',
            authInfo: null
          });
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Math metrics based on products loaded
  const catalogSize = products.length;
  const totalValuation = products.reduce((acc, p) => acc + (p.price * p.stock), 0);
  const lowStockCount = products.filter(p => p.stock <= 5).length;
  const totalStockCount = products.reduce((acc, p) => acc + p.stock, 0);

  return (
    <div id="app-root" className="min-h-screen bg-slate-50 text-slate-800 antialiased font-sans">
      
      {/* Dynamic Success Notification */}
      <AnimatePresence>
        {successToast && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border border-slate-700 text-white shadow-xl py-3 px-6 rounded-xl flex items-center space-x-3"
          >
            <CheckCircle2 className="text-emerald-400 w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium">{successToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Professional Header Banner */}
      <header className="sticky top-0 z-30 bg-white/70 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          
          <div className="flex items-center space-x-3">
            <div className="bg-slate-900 text-white p-2.5 rounded-xl shadow-md">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">CatalogoPro</h1>
              <p className="text-xs text-slate-500 font-mono">Consola de Inventario & Permisos</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {authLoading ? (
              <div className="flex items-center space-x-2 text-slate-400 animate-pulse text-sm">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Verificando...</span>
              </div>
            ) : currentUser ? (
              <div className="flex items-center space-x-3 bg-slate-100 p-1.5 pl-3 pr-2.5 rounded-2xl border border-slate-200">
                <div className="text-right hidden sm:block">
                  <div className="flex items-center justify-end space-x-1.5">
                    {isAdmin && (
                      <span className="bg-indigo-600 text-[10px] text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                        ADMIN
                      </span>
                    )}
                    <span className="text-xs font-semibold text-slate-900 truncate max-w-[150px]">
                      {currentUser.displayName || currentUser.email}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-mono max-w-[180px] truncate">{currentUser.email}</p>
                </div>

                {currentUser.photoURL ? (
                  <img 
                    src={currentUser.photoURL} 
                    referrerPolicy="no-referrer"
                    alt="Perfil" 
                    className="w-9 h-9 rounded-xl object-cover border-2 border-slate-300" 
                  />
                ) : (
                  <div className="bg-slate-900 text-white w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm">
                    {currentUser.email?.charAt(0).toUpperCase()}
                  </div>
                )}

                <button 
                  onClick={handleLogout}
                  className="p-2 text-slate-500 hover:text-red-600 hover:bg-slate-200/50 rounded-lg transition-all"
                  title="Cerrar sesión"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button 
                onClick={handleLogin}
                className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold py-2 px-4 rounded-xl shadow-sm hover:shadow transition-all flex items-center space-x-2 border border-slate-800"
              >
                <LogIn className="w-4 h-4" />
                <span>Iniciar con Google</span>
              </button>
            )}
          </div>

        </div>
      </header>

      {/* Main Workspace Frame */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Permission Warnings If Unauthorized */}
        {!currentUser && (
          <div className="mb-6 bg-slate-900 text-slate-100 rounded-2xl p-6 shadow-lg border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start space-x-4">
              <div className="bg-slate-800/80 text-yellow-500 p-3 rounded-xl border border-slate-700 mt-1 md:mt-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Se requiere autenticación para administrar productos</h3>
                <p className="text-sm text-slate-400 max-w-2xl mt-1">
                  Actualmente te encuentras en modo de <strong className="text-indigo-400">Lectura Pública</strong>. Puedes buscar y filtrar todos los productos del inventario, pero necesitas iniciar sesión con tu cuenta de Google si deseas crear, editar o eliminar registros para evitar errores de permisos insuficientes.
                </p>
              </div>
            </div>
            <button 
              onClick={handleLogin}
              className="bg-white hover:bg-slate-100 text-slate-900 text-sm font-bold py-2.5 px-5 rounded-xl transition-all flex items-center justify-center space-x-2 self-start md:self-center flex-shrink-0"
            >
              <LogIn className="w-4 h-4" />
              <span>Conectar Ahora</span>
            </button>
          </div>
        )}

        {/* Display Diagnostics error when permission-denied captures */}
        <AnimatePresence>
          {diagnosticError && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mb-8 overflow-hidden"
            >
              <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-start space-x-3.5">
                  <div className="bg-red-100 text-red-700 p-2.5 rounded-xl flex-shrink-0">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-red-900 font-bold text-lg">Error de Seguridad Firestore Detectado</h3>
                      <button 
                        onClick={() => setDiagnosticError(null)}
                        className="text-red-400 hover:text-red-700 p-1 rounded-full transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    
                    <p className="text-sm text-red-800 mt-1.5 font-medium">
                      La base de datos denegó la operación (<span className="capitalize font-bold text-red-950">{diagnosticError.operationType}</span>) sobre la ruta <code className="bg-red-100 text-red-950 px-1.5 py-0.5 rounded font-mono text-xs font-bold font-semibold">{diagnosticError.path || 'products'}</code> debido a <span className="font-bold underline text-red-950">Permisos Insuficientes</span>.
                    </p>

                    <div className="mt-4 bg-white/70 backdrop-blur rounded-xl p-4 border border-red-200/50">
                      <h4 className="text-xs uppercase tracking-wider text-slate-600 font-bold mb-2">Estado de Autenticación durante Fallo:</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div className="bg-red-50/50 p-2.5 rounded-lg border border-red-200/30">
                          <span className="text-slate-500 block">UID de Usuario:</span>
                          <span className="font-mono font-semibold text-slate-800 truncate block">
                            {diagnosticError.authInfo?.userId || 'Nulo (No autenticado)'}
                          </span>
                        </div>
                        <div className="bg-red-50/50 p-2.5 rounded-lg border border-red-200/30">
                          <span className="text-slate-500 block">Email del Intentador:</span>
                          <span className="font-semibold text-slate-800 truncate block">
                            {diagnosticError.authInfo?.email || 'Nulo (Sin sesión)'}
                          </span>
                        </div>
                        <div className="bg-red-50/50 p-2.5 rounded-lg border border-red-200/30">
                          <span className="text-slate-500 block">Verificado por Firebase:</span>
                          <span className="font-semibold text-slate-800 block">
                            {diagnosticError.authInfo?.emailVerified ? '✅ SÍ' : '❌ NO'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 text-xs text-red-700 flex items-center space-x-1.5 bg-red-100/30 py-2 px-3 rounded-lg border border-red-200/30">
                      <Info className="w-4 h-4 text-red-600 flex-shrink-0" />
                      <span>
                        <strong>Consejo Técnico:</strong> Crea un producto o inicia sesión con una cuenta autorizada. Las reglas deniegan escrituras de terceros no creadores.
                      </span>
                    </div>

                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dashboard Grid Statistics */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center space-x-4">
            <div className="bg-blue-50 text-blue-600 p-3.5 rounded-xl border border-blue-100">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Productos</p>
              <h4 className="text-2xl font-black text-slate-900 mt-1">
                {productsLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                ) : (
                  catalogSize
                )}
              </h4>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center space-x-4">
            <div className="bg-emerald-50 text-emerald-600 p-3.5 rounded-xl border border-emerald-100">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Valor de Catálogo</p>
              <h4 className="text-2xl font-black text-slate-900 mt-1">
                {productsLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                ) : (
                  `$${totalValuation.toLocaleString('es-ES')}`
                )}
              </h4>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center space-x-4">
            <div className="bg-amber-50 text-amber-600 p-3.5 rounded-xl border border-amber-100">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Stock Crítico (≤ 5)</p>
              <h4 className="text-2xl font-black text-slate-900 mt-1">
                {productsLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                ) : (
                  lowStockCount
                )}
              </h4>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center space-x-4">
            <div className="bg-indigo-50 text-indigo-600 p-3.5 rounded-xl border border-indigo-100">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Unidades Totales</p>
              <h4 className="text-2xl font-black text-slate-900 mt-1">
                {productsLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                ) : (
                  totalStockCount
                )}
              </h4>
            </div>
          </div>

        </section>

        {/* Dashboard Filters & Catalog List */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8">
          
          {/* Filter Bar Panel */}
          <div className="p-6 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input 
                  type="text" 
                  placeholder="Buscar por nombre, descripción o creador..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400"
                />
              </div>

              {/* Price filter input */}
              <div className="flex items-center space-x-2 bg-white px-3 py-1 border border-slate-200 rounded-xl">
                <Filter className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span className="text-xs text-slate-500 font-semibold">Precio máx:</span>
                <input 
                  type="number" 
                  value={priceRange.max}
                  onChange={(e) => setPriceRange(prev => ({ ...prev, max: Number(e.target.value) || 10000 }))}
                  className="w-18 bg-transparent text-xs text-slate-800 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded px-1"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Stock Filter Selection */}
              <div className="flex bg-slate-100 rounded-xl p-1 border border-slate-200 text-xs font-medium">
                <button 
                  onClick={() => setStockFilter('all')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${stockFilter === 'all' ? 'bg-white text-slate-900 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  Todos
                </button>
                <button 
                  onClick={() => setStockFilter('instock')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${stockFilter === 'instock' ? 'bg-white text-slate-900 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  Con Stock
                </button>
                <button 
                  onClick={() => setStockFilter('lowstock')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${stockFilter === 'lowstock' ? 'bg-white text-slate-900 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  Críticos
                </button>
              </div>

              {/* Active Create Button or Seeder */}
              <div className="flex space-x-2">
                {currentUser && products.length === 0 && (
                  <button 
                    onClick={handleSeedDatabase}
                    disabled={isSubmitting}
                    className="border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 text-xs font-bold px-4 py-2.5 rounded-xl transition-all flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Cargar Semillas de Prueba</span>
                  </button>
                )}

                <button 
                  onClick={() => {
                    setEditingId(null);
                    setFormInput({
                      name: '',
                      description: '',
                      price: 0,
                      stock: 0,
                      category: 'Tecnología',
                      imageUrl: ''
                    });
                    setIsFormOpen(true);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 md:px-5 py-2.5 rounded-xl shadow-sm flex items-center space-x-1.5 transition-all hover:scale-[1.02]"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nuevo Producto</span>
                </button>
              </div>
            </div>
          </div>

          {/* Categories Selector Ribbon */}
          <div className="px-6 py-3.5 border-b border-slate-100 bg-white shadow-inner flex items-center space-x-2 overflow-x-auto no-scrollbar">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide mr-2">Categorías:</span>
            <button 
              onClick={() => setSelectedCategory('Todos')}
              className={`text-xs px-3.5 py-1.5 rounded-full font-bold transition-all flex-shrink-0 ${selectedCategory === 'Todos' ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-150 text-slate-600 hover:bg-slate-200'}`}
            >
              Todos ({products.length})
            </button>
            {CATEGORIES.map(category => {
              const count = products.filter(p => p.category === category).length;
              return (
                <button 
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`text-xs px-3.5 py-1.5 rounded-full font-bold transition-all flex-shrink-0 ${selectedCategory === category ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {category} {count > 0 && <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full font-black ml-1 scale-90 inline-block">{count}</span>}
                </button>
              );
            })}
          </div>

          {/* Product Cards Table list */}
          <div className="p-6">
            {productsLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <RefreshCw className="w-9 h-9 animate-spin text-indigo-500 mb-3" />
                <p className="font-semibold text-slate-600">Sincronizando con base de datos en la nube...</p>
                <p className="text-xs text-slate-400 mt-1">Conectado a Firestore Realtime Engine</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-16">
                <div className="bg-slate-100 text-slate-400 p-4 rounded-full w-14 h-14 flex items-center justify-center mx-auto mb-4">
                  <Database className="w-6 h-6" />
                </div>
                <h3 className="text-slate-900 font-bold text-lg">No se encontraron productos</h3>
                <p className="text-slate-500 text-sm max-w-md mx-auto mt-1.5">
                  Prueba cambiando los filtros de categoría, buscando por otro término, o inicia sesión con Google para poblar con semillas de demostración.
                </p>
                {!currentUser && (
                  <p className="text-indigo-600 font-bold text-xs mt-3">
                    * Iniciar sesión habilita la carga inicial de productos de prueba instantáneamente.
                  </p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.map(product => {
                  const isOwner = currentUser?.uid === product.createdBy;
                  const canEdit = isAdmin || isOwner;

                  return (
                    <motion.div 
                      key={product.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md transition-all group"
                    >
                      <div>
                        {/* Image area */}
                        <div className="relative h-44 bg-slate-100 overflow-hidden">
                          <img 
                            src={product.imageUrl || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&auto=format&fit=crop&q=60'} 
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              // fallback on loading errors
                              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&auto=format&fit=crop&q=60';
                            }}
                          />
                          <div className="absolute top-3 left-3 flex flex-col space-y-1 items-start">
                            <span className="bg-slate-900/85 backdrop-blur-sm text-[10px] text-white font-bold py-1 px-2.5 rounded-full shadow-sm flex items-center space-x-1 uppercase">
                              <Tag className="w-2.5 h-2.5 mr-0.5" />
                              {product.category}
                            </span>
                            
                            {/* Stock status badge */}
                            {product.stock === 0 ? (
                              <span className="bg-red-500/90 backdrop-blur-sm text-[10px] text-white font-bold py-1 px-2.5 rounded-full shadow-sm">
                                Agotado
                              </span>
                            ) : product.stock <= 5 ? (
                              <span className="bg-amber-500/90 backdrop-blur-sm text-[10px] text-slate-905 font-bold py-1 px-2.5 rounded-full shadow-sm">
                                Bajo stock: {product.stock} un.
                              </span>
                            ) : (
                              <span className="bg-emerald-500/90 backdrop-blur-sm text-[10px] text-white font-bold py-1 px-2.5 rounded-full shadow-sm">
                                Stock ok: {product.stock} un.
                              </span>
                            )}
                          </div>

                          <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-sm text-slate-900 border border-slate-200 text-lg font-black tracking-tight py-1 px-3.5 rounded-xl shadow-md">
                            ${product.price}
                          </div>
                        </div>

                        {/* Title & info area */}
                        <div className="p-5">
                          <h4 className="font-bold text-slate-900 text-base leading-snug group-hover:text-indigo-600 transition-colors line-clamp-1">
                            {product.name}
                          </h4>
                          <p className="text-slate-500 text-xs mt-1.5 line-clamp-2 h-8 leading-relaxed">
                            {product.description || 'Sin descripción detallada.'}
                          </p>

                          {/* Valuation math */}
                          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                            <div>
                              <span className="block font-medium text-slate-400">Valuación en Almacén:</span>
                              <span className="font-bold text-slate-900 text-sm">
                                ${((product.price || 0) * (product.stock || 0)).toLocaleString('es-ES')}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="block font-medium text-slate-400">Creado por:</span>
                              <span className="font-semibold text-indigo-600 block max-w-[120px] truncate" title={product.creatorEmail}>
                                {isOwner ? 'Mí (Tú)' : product.creatorEmail.split('@')[0]}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Hover action bar or options */}
                      <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                        <span className="text-[10px] font-mono text-slate-400 block">
                          F. Reg: {formatTimestamp(product.createdAt)}
                        </span>

                        <div className="flex items-center space-x-2">
                          {canEdit ? (
                            <>
                              <button 
                                onClick={() => openEditModal(product)}
                                className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg border border-slate-200/50 bg-white shadow-sm transition-all"
                                title="Editar producto"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => handleDeleteProduct(product.id)}
                                className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg border border-slate-200/50 bg-white shadow-sm transition-all"
                                title="Eliminar producto"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <div className="text-[10px] text-slate-400 font-semibold bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200/50 flex items-center space-x-1" title="Sólo puede modificarlo el autor de este producto.">
                              <UserIcon className="w-2.5 h-2.5" />
                              <span>Lectura</span>
                            </div>
                          )}
                        </div>
                      </div>

                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

        </section>

      </main>

      {/* Slideout Form Panel Component for Creations/Edits */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
            
            {/* Backdrop cover overlay */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!isSubmitting) {
                  setIsFormOpen(false);
                  setEditingId(null);
                }
              }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            />

            {/* Container drawer */}
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between"
            >
              <div className="p-6 overflow-y-auto flex-1">
                
                {/* Drawer Header */}
                <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-6">
                  <div>
                    <h2 className="text-lg font-black text-slate-900">
                      {editingId ? 'Editar Producto' : 'Agregar Nuevo Producto'}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1 mr-4">
                      {editingId 
                        ? 'Actualiza la información del producto. Los cambios se sincronizarán inmediatamente.' 
                        : 'Introduce la información del nuevo elemento para integrarlo al catálogo.'}
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      setIsFormOpen(false);
                      setEditingId(null);
                    }}
                    disabled={isSubmitting}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-150 rounded-full transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Info alert if trying to edit without permissions warnings */}
                {!currentUser && (
                  <div className="mb-6 bg-amber-50 rounded-xl p-4 border border-amber-200 text-xs text-amber-800 flex items-start space-x-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <strong className="font-bold">¡Se requiere autenticación!</strong> Debe iniciar sesión para poder crear o guardar este formulario.
                    </div>
                  </div>
                )}

                {/* Form Inputs Container */}
                <form id="product-panel-form" onSubmit={handleFormSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Nombre del Producto *</label>
                    <input 
                      type="text" 
                      name="name"
                      required
                      placeholder="Ej. Consola Sony PlayStation 5"
                      value={formInput.name}
                      onChange={handleInputChange}
                      className="w-full text-sm px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Categoría *</label>
                    <select 
                      name="category"
                      value={formInput.category}
                      onChange={handleInputChange}
                      className="w-full text-sm px-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-slate-700"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Precio (USD) *</label>
                      <input 
                        type="number" 
                        name="price"
                        required
                        min="0"
                        placeholder="0.00"
                        value={formInput.price}
                        onChange={handleInputChange}
                        className="w-full text-sm px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Stock Inicial *</label>
                      <input 
                        type="number" 
                        name="stock"
                        required
                        min="0"
                        placeholder="0"
                        value={formInput.stock}
                        onChange={handleInputChange}
                        className="w-full text-sm px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Descripción Detallada</label>
                    <textarea 
                      name="description"
                      rows={3}
                      placeholder="Agrega características, estado, especificaciones técnicas o detalles del producto..."
                      value={formInput.description}
                      onChange={handleInputChange}
                      className="w-full text-sm px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none placeholder:text-slate-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Enlace / URL de la Imagen</label>
                    <input 
                      type="url" 
                      name="imageUrl"
                      placeholder="https://images.unsplash.com/your-photo-path..."
                      value={formInput.imageUrl}
                      onChange={handleInputChange}
                      className="w-full text-sm px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Si la dejas en blanco, utilizaremos una foto predeterminada para el catálogo.</p>
                  </div>
                </form>

              </div>

              {/* Form Footer Action */}
              <div className="p-6 bg-slate-50 border-t border-slate-200 flex space-x-3">
                <button 
                  type="button"
                  onClick={() => {
                    setIsFormOpen(false);
                    setEditingId(null);
                  }}
                  disabled={isSubmitting}
                  className="w-1/2 bg-white hover:bg-slate-100 text-slate-700 font-bold py-3 px-4 rounded-xl border border-slate-200 transition-all text-sm flex items-center justify-center disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  form="product-panel-form"
                  disabled={isSubmitting || !currentUser}
                  className="w-1/2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all text-sm flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <span>{editingId ? 'Guardar Cambios' : 'Agregar Producto'}</span>
                  )}
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Humble Footer */}
      <footer className="bg-slate-900 text-slate-400 py-10 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center bg-slate-900 text-sm">
          <div className="flex items-center justify-center space-x-2 text-slate-300 font-bold mb-3">
            <Package className="w-4 h-4 text-indigo-500" />
            <span>CatalogoPro Console</span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed max-w-lg mx-auto">
            Este software utiliza un motor de Zero-Trust Firestore Security. Tus datos están resguardados contra manipulaciones externas de identidad, garantizando la consistencia del inventario.
          </p>
          <div className="text-[10px] text-slate-600 border-t border-slate-800 mt-6 pt-4 font-mono">
            Propietario del Applet: {currentUser?.email || 'robymetalero@gmail.com'} • UTC Time: 2026-06-23
          </div>
        </div>
      </footer>

    </div>
  );
}
