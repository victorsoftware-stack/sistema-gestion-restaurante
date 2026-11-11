import { useEffect, useState } from 'react';
import { FolderPlus, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { formatCurrency, menuApi } from '../services/api.js';

const EMPTY_DISH_FORM = {
  id: null,
  category_id: '',
  name: '',
  description: '',
  price: '',
  available: true,
};

export default function MenuPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'administrador';
  const isStaff = user?.role === 'mesero' || isAdmin;

  const [categories, setCategories] = useState([]);
  const [dishes, setDishes] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const [showDishForm, setShowDishForm] = useState(false);
  const [dishForm, setDishForm] = useState(EMPTY_DISH_FORM);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [categoryDesc, setCategoryDesc] = useState('');

  async function loadMenu() {
    setLoading(true);
    try {
      const [catRes, dishRes] = await Promise.all([
        menuApi.listCategories(),
        menuApi.listDishes({ categoryId: selectedCategory, search }),
      ]);
      setCategories(catRes.categories);
      setDishes(dishRes.dishes);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMenu();
  }, [selectedCategory, search]);

  function openNewDish() {
    setDishForm({
      ...EMPTY_DISH_FORM,
      category_id: categories[0]?.id ? String(categories[0].id) : '',
    });
    setShowDishForm(true);
    setShowCategoryForm(false);
  }

  function openEditDish(dish) {
    setDishForm({
      id: dish.id,
      category_id: String(dish.category_id),
      name: dish.name,
      description: dish.description || '',
      price: String(dish.price),
      available: dish.available,
    });
    setShowDishForm(true);
    setShowCategoryForm(false);
  }

  async function handleSaveDish(e) {
    e.preventDefault();
    setFeedback({ type: '', message: '' });
    try {
      const payload = {
        category_id: Number(dishForm.category_id),
        name: dishForm.name.trim(),
        description: dishForm.description.trim(),
        price: Number(dishForm.price),
        available: dishForm.available,
      };
      if (dishForm.id) {
        await menuApi.updateDish(dishForm.id, payload);
        setFeedback({ type: 'success', message: 'Plato actualizado correctamente.' });
      } else {
        await menuApi.createDish(payload);
        setFeedback({ type: 'success', message: 'Plato agregado al menú digital.' });
      }
      setShowDishForm(false);
      setDishForm(EMPTY_DISH_FORM);
      await loadMenu();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    }
  }

  async function handleCreateCategory(e) {
    e.preventDefault();
    setFeedback({ type: '', message: '' });
    try {
      await menuApi.createCategory({
        name: categoryName.trim(),
        description: categoryDesc.trim(),
        display_order: categories.length + 1,
      });
      setCategoryName('');
      setCategoryDesc('');
      setShowCategoryForm(false);
      setFeedback({ type: 'success', message: 'Categoría creada correctamente.' });
      await loadMenu();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    }
  }

  async function handleToggleAvailability(dish) {
    setFeedback({ type: '', message: '' });
    try {
      await menuApi.toggleAvailability(dish.id, !dish.available);
      await loadMenu();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    }
  }

  async function handleDeleteDish(dish) {
    setFeedback({ type: '', message: '' });
    try {
      await menuApi.deleteDish(dish.id);
      setFeedback({ type: 'success', message: `Plato "${dish.name}" eliminado.` });
      await loadMenu();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Menú Digital</h1>
          <p className="text-sm text-slate-600">
            Catálogo de platos, categorías y disponibilidad en tiempo real.
          </p>
        </div>

        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setShowCategoryForm((v) => !v);
                setShowDishForm(false);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <FolderPlus className="w-4 h-4" />
              <span>Nueva categoría</span>
            </button>
            <button
              type="button"
              onClick={openNewDish}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo plato</span>
            </button>
          </div>
        )}
      </div>

      {feedback.message && (
        <div
          className={`p-3.5 rounded-xl border text-sm ${
            feedback.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {showCategoryForm && isAdmin && (
        <form
          onSubmit={handleCreateCategory}
          className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4"
        >
          <h2 className="font-semibold text-slate-900">Crear categoría</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <input
              type="text"
              required
              minLength={2}
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="Nombre de la categoría"
              className="px-3.5 py-2 rounded-lg border border-slate-300"
            />
            <input
              type="text"
              value={categoryDesc}
              onChange={(e) => setCategoryDesc(e.target.value)}
              placeholder="Descripción breve (opcional)"
              className="px-3.5 py-2 rounded-lg border border-slate-300"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowCategoryForm(false)}
              className="px-3.5 py-2 rounded-lg border border-slate-300 text-sm text-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium"
            >
              Guardar categoría
            </button>
          </div>
        </form>
      )}

      {showDishForm && isAdmin && (
        <form
          onSubmit={handleSaveDish}
          className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4"
        >
          <h2 className="font-semibold text-slate-900">
            {dishForm.id ? 'Editar plato' : 'Agregar plato al menú'}
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <select
              required
              value={dishForm.category_id}
              onChange={(e) => setDishForm({ ...dishForm, category_id: e.target.value })}
              className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white"
            >
              <option value="">Selecciona categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              required
              minLength={2}
              value={dishForm.name}
              onChange={(e) => setDishForm({ ...dishForm, name: e.target.value })}
              placeholder="Nombre del plato"
              className="px-3.5 py-2 rounded-lg border border-slate-300"
            />
            <input
              type="number"
              required
              min={0}
              step="100"
              value={dishForm.price}
              onChange={(e) => setDishForm({ ...dishForm, price: e.target.value })}
              placeholder="Precio (COP)"
              className="px-3.5 py-2 rounded-lg border border-slate-300"
            />
            <label className="flex items-center gap-2 text-sm text-slate-700 px-2">
              <input
                type="checkbox"
                checked={dishForm.available}
                onChange={(e) => setDishForm({ ...dishForm, available: e.target.checked })}
                className="rounded border-slate-300"
              />
              <span>Disponible para pedidos</span>
            </label>
          </div>
          <input
            type="text"
            value={dishForm.description}
            onChange={(e) => setDishForm({ ...dishForm, description: e.target.value })}
            placeholder="Descripción / ingredientes"
            className="w-full px-3.5 py-2 rounded-lg border border-slate-300"
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowDishForm(false)}
              className="px-3.5 py-2 rounded-lg border border-slate-300 text-sm text-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium"
            >
              {dishForm.id ? 'Actualizar plato' : 'Crear plato'}
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedCategory('')}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${
              selectedCategory === ''
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            Todas
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(String(cat.id))}
              className={`px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${
                selectedCategory === String(cat.id)
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar plato..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
          Cargando catálogo del menú...
        </div>
      ) : dishes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
          No se encontraron platos con el filtro aplicado.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {dishes.map((dish) => (
            <article
              key={dish.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between gap-4"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                    {dish.category_name}
                  </span>
                  <span
                    className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                      dish.available
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {dish.available ? 'Disponible' : 'Agotado'}
                  </span>
                </div>
                <h3 className="font-semibold text-lg text-slate-900">{dish.name}</h3>
                <p className="text-sm text-slate-600 mt-1">
                  {dish.description || 'Preparación tradicional de la casa.'}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <span className="text-lg font-bold text-slate-900">
                  {formatCurrency(dish.price)}
                </span>

                <div className="flex items-center gap-1.5">
                  {isStaff && (
                    <button
                      type="button"
                      onClick={() => handleToggleAvailability(dish)}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      {dish.available ? 'Agotar' : 'Habilitar'}
                    </button>
                  )}
                  {isAdmin && (
                    <>
                      <button
                        type="button"
                        onClick={() => openEditDish(dish)}
                        aria-label={`Editar ${dish.name}`}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteDish(dish)}
                        aria-label={`Eliminar ${dish.name}`}
                        className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
