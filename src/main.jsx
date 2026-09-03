import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ChevronLeft, ChevronRight, Copy, ExternalLink, ImagePlus, LayoutDashboard, Link2, LogOut, Pencil, Plus, Search, Trash2, UploadCloud } from 'lucide-react';
import './styles.css';

const seedProducts = [
  { id: 1, code: 'UPCHA123', name: 'Minimal Everyday Sneakers', price: 1499, originalPrice: 2999, description: 'Comfort-first everyday sneakers with a clean, versatile finish.', images: ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80','https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=1200&q=80','https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=1200&q=80'], affiliateUrl: 'https://example.com/affiliate/sneakers', status: 'Published' },
  { id: 2, code: 'UPCHA456', name: 'Classic Smart Watch', price: 999, originalPrice: 1999, description: 'Simple smart features for daily use with a lightweight profile.', images: ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=80'], affiliateUrl: 'https://example.com/affiliate/watch', status: 'Draft' },
];

function App() {
  const [mode, setMode] = useState('public');
  const [products, setProducts] = useState(seedProducts);
  const [query, setQuery] = useState('');
  const [code, setCode] = useState('');
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState('');

  const product = selected || products.find((item) => item.code.toLowerCase() === code.trim().toLowerCase() && item.status === 'Published');

  const filtered = useMemo(() => products.filter((item) => [item.code, item.name].join(' ').toLowerCase().includes(query.toLowerCase())), [products, query]);

  function showToast(message) { setToast(message); window.setTimeout(() => setToast(''), 2200); }
  function findProduct(e) { e.preventDefault(); const found = products.find((item) => item.code.toLowerCase() === code.trim().toLowerCase() && item.status === 'Published'); setSelected(found || null); if (!found) showToast('Product code not found.'); }
  function copyProductLink(p) { navigator.clipboard?.writeText(window.location.origin + '/?code=' + encodeURIComponent(p.code)); showToast('Product link copied.'); }

  return <div className="app">
    {mode === 'public' ? <PublicPage product={product} code={code} setCode={setCode} onFind={findProduct} onBack={() => { setSelected(null); setCode(''); }} /> : <AdminPage products={products} setProducts={setProducts} filtered={filtered} query={query} setQuery={setQuery} onCopy={copyProductLink} showToast={showToast} />}
    <button className="admin-switch" onClick={() => setMode(mode === 'public' ? 'admin' : 'public')} aria-label="Switch view">{mode === 'public' ? <LayoutDashboard size={17}/> : <ExternalLink size={17}/>} {mode === 'public' ? 'Admin' : 'Public'}</button>
    {toast && <div className="toast">{toast}</div>}
  </div>;
}

function PublicPage({ product, code, setCode, onFind, onBack }) {
  return <main className="public-shell">
    <div className="brand">UPCHA</div>
    {!product ? <section className="lookup-card">
      <div className="eyebrow">PRODUCT ACCESS</div>
      <h1>Enter your product code</h1>
      <p>Use the code shared with you on Instagram to open the product.</p>
      <form onSubmit={onFind} className="lookup-form">
        <label htmlFor="code">Product code</label>
        <input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. UPCHA123" autoComplete="off" />
        <button type="submit">GET PRODUCT <ExternalLink size={17}/></button>
      </form>
      <div className="trust-row"><span>✓ No login required</span><span>✓ Secure redirect</span></div>
    </section> : <ProductView product={product} onBack={onBack} />}
    <footer>Affiliate product showcase · Prices and availability may change on the seller website.</footer>
  </main>;
}

function ProductView({ product, onBack }) {
  const [index, setIndex] = useState(0);
  const next = () => setIndex((index + 1) % product.images.length);
  const prev = () => setIndex((index - 1 + product.images.length) % product.images.length);
  return <section className="product-layout">
    <button className="back-btn" onClick={onBack}><ChevronLeft size={17}/> Back</button>
    <div className="product-image-wrap">
      <img src={product.images[index]} alt={product.name} className="product-image" />
      {product.images.length > 1 && <><button className="image-nav left" onClick={prev}><ChevronLeft/></button><button className="image-nav right" onClick={next}><ChevronRight/></button></>}
      <div className="dots">{product.images.map((_, i) => <button key={i} onClick={() => setIndex(i)} className={i === index ? 'dot active' : 'dot'} aria-label={'Show image ' + (i + 1)} />)}</div>
    </div>
    <div className="product-info">
      <div className="pill">CODE · {product.code}</div>
      <h1>{product.name}</h1>
      <div className="price-row"><strong>₹{product.price.toLocaleString('en-IN')}</strong><del>₹{product.originalPrice.toLocaleString('en-IN')}</del></div>
      <div className="save">Save ₹{(product.originalPrice - product.price).toLocaleString('en-IN')}</div>
      <p className="description">{product.description}</p>
      <a className="buy-btn" href={product.affiliateUrl} target="_blank" rel="noreferrer">BUY NOW <ExternalLink size={18}/></a>
      <p className="redirect-note">You will be redirected to the seller to complete your purchase.</p>
    </div>
  </section>;
}

function AdminPage({ products, setProducts, filtered, query, setQuery, onCopy, showToast }) {
  const [editing, setEditing] = useState(null);
  const blank = { id: Date.now(), code: '', name: '', price: '', originalPrice: '', description: '', images: [], affiliateUrl: '', status: 'Draft' };
  const [draft, setDraft] = useState(blank);

  function openNew() { setEditing('new'); setDraft({ ...blank, id: Date.now() }); }
  function openEdit(p) { setEditing(p.id); setDraft({ ...p }); }
  function save(e) { e.preventDefault(); if (!draft.code || !draft.name || !draft.price || !draft.affiliateUrl || !draft.images.length) { showToast('Add code, name, price, affiliate link and at least one image.'); return; } setProducts((list) => editing === 'new' ? [{ ...draft, price: Number(draft.price), originalPrice: Number(draft.originalPrice || draft.price) }, ...list] : list.map((p) => p.id === editing ? { ...draft, price: Number(draft.price), originalPrice: Number(draft.originalPrice || draft.price) } : p)); setEditing(null); showToast(editing === 'new' ? 'Product published to dashboard.' : 'Product updated.'); }
  function remove(id) { setProducts((list) => list.filter((p) => p.id !== id)); showToast('Product deleted.'); }

  return <main className="admin-shell">
    <header className="admin-header"><div><div className="brand dark">UPCHA</div><div className="admin-title">Product Control Center</div></div><button className="primary-btn" onClick={openNew}><Plus size={18}/> Add product</button></header>
    <section className="stats"><Stat label="Total products" value={products.length}/><Stat label="Published" value={products.filter(p => p.status === 'Published').length}/><Stat label="Drafts" value={products.filter(p => p.status === 'Draft').length}/><Stat label="Image slots" value={products.reduce((n,p) => n + p.images.length, 0)}/></section>
    <section className="panel">
      <div className="panel-top"><div><h2>Products</h2><p>Manage codes, pricing, images and affiliate destinations.</p></div><div className="search"><Search size={17}/><input placeholder="Search by code or name" value={query} onChange={e => setQuery(e.target.value)} /></div></div>
      <div className="table-wrap"><table><thead><tr><th>Product</th><th>Code</th><th>Price</th><th>Images</th><th>Status</th><th></th></tr></thead><tbody>{filtered.map((p) => <tr key={p.id}><td><div className="product-cell"><img src={p.images[0]} alt=""/><span>{p.name}</span></div></td><td><span className="code">{p.code}</span></td><td>₹{Number(p.price).toLocaleString('en-IN')}</td><td>{p.images.length}/4</td><td><span className={'status ' + p.status.toLowerCase()}>{p.status}</span></td><td><div className="actions"><button onClick={() => onCopy(p)} title="Copy public link"><Copy size={16}/></button><button onClick={() => openEdit(p)} title="Edit"><Pencil size={16}/></button><button onClick={() => remove(p.id)} title="Delete"><Trash2 size={16}/></button></div></td></tr>)}</tbody></table></div>
    </section>
    {editing && <div className="modal-backdrop"><form className="modal" onSubmit={save}><div className="modal-head"><div><div className="eyebrow">ADMIN · PRODUCT</div><h2>{editing === 'new' ? 'Publish a product' : 'Edit product'}</h2></div><button type="button" onClick={() => setEditing(null)} className="icon-btn">×</button></div>
      <div className="form-grid"><Field label="Product code" value={draft.code} onChange={v => setDraft({...draft, code:v.toUpperCase()})} placeholder="UPCHA123"/><Field label="Product name" value={draft.name} onChange={v => setDraft({...draft, name:v})} placeholder="Product name"/><Field label="Selling price" value={draft.price} onChange={v => setDraft({...draft, price:v})} placeholder="1499" type="number"/><Field label="Original price" value={draft.originalPrice} onChange={v => setDraft({...draft, originalPrice:v})} placeholder="2999" type="number"/></div>
      <label className="field"><span>Description</span><textarea value={draft.description} onChange={e => setDraft({...draft, description:e.target.value})} placeholder="Short product description" /></label>
      <label className="field"><span>Affiliate link</span><div className="input-icon"><Link2 size={17}/><input value={draft.affiliateUrl} onChange={e => setDraft({...draft, affiliateUrl:e.target.value})} placeholder="https://..." /></div></label>
      <div className="field"><span>Product images <em>Maximum 4</em></span><div className="image-slots">{[0,1,2,3].map((i) => <div className="slot" key={i}>{draft.images[i] ? <img src={draft.images[i]} alt=""/> : <><ImagePlus size={21}/><small>Image {i+1}</small></>}{draft.images[i] && <button type="button" onClick={() => setDraft({...draft, images:draft.images.filter((_,idx)=>idx!==i)})}>×</button>}</div>)}</div><div className="url-upload"><UploadCloud size={17}/><input placeholder="Paste image URL to add" onKeyDown={e => { if(e.key === 'Enter'){ e.preventDefault(); const val=e.currentTarget.value.trim(); if(val && draft.images.length<4){ setDraft({...draft, images:[...draft.images,val]}); e.currentTarget.value=''; } }}}/><span>Press Enter</span></div></div>
      <div className="publish-row"><label className="switchline"><input type="checkbox" checked={draft.status === 'Published'} onChange={e => setDraft({...draft,status:e.target.checked?'Published':'Draft'})}/><span>Publish now</span></label><button className="primary-btn" type="submit">{editing === 'new' ? 'Publish product' : 'Save changes'}</button></div>
    </form></div>}
  </main>;
}

function Field({label,value,onChange,placeholder,type='text'}) { return <label className="field"><span>{label}</span><input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/></label>; }
function Stat({label,value}) { return <div className="stat"><span>{label}</span><strong>{value}</strong></div>; }

createRoot(document.getElementById('root')).render(<App/>);
