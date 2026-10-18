'use client'

import {useEffect, useState} from 'react'
import Link from 'next/link'
import {ArrowLeft, Eye, Save, TriangleAlert} from 'lucide-react'
import {showroom} from '@/data'
import {PageHeader} from '@/components/admin-shell'

type FormState = typeof showroom
const initial:FormState = structuredClone(showroom)
const inputClass='h-10 w-full border border-neutral-200 bg-white px-3 text-sm outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-100'
const labelClass='mb-1.5 block text-xs font-semibold text-neutral-600'

function Field({label,value,onChange,placeholder,type='text'}:{label:string;value:string;onChange:(v:string)=>void;placeholder?:string;type?:string}){return <label className="block"><span className={labelClass}>{label}</span><input type={type} className={inputClass} value={value} placeholder={placeholder} onChange={e=>onChange(e.target.value)} /></label>}
function Section({title,children}:{title:string;children:React.ReactNode}){return <section className="border border-neutral-200 bg-white p-5"><h2 className="mb-5 text-sm font-bold tracking-tight">{title}</h2>{children}</section>}

export default function ShowroomSettingsPage(){
 const [form,setForm]=useState<FormState>(initial); const [saved,setSaved]=useState(true)
 useEffect(()=>{const warn=(event:BeforeUnloadEvent)=>{if(!saved){event.preventDefault();event.returnValue=''}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[saved])
 const set=(patch:Partial<FormState>)=>{setForm(v=>({...v,...patch}));setSaved(false)}
 const setNested=(key:'colors'|'contact'|'address'|'social'|'seo',patch:Record<string,string>)=>set({[key]:{...form[key],...patch}} as Partial<FormState>)
 const contrast=(hex:string)=>{const n=parseInt(hex.replace('#',''),16);const r=(n>>16)&255,g=(n>>8)&255,b=n&255;return (r*299+g*587+b*114)/1000>155?'dark':'light'}
 const onSubmit=(e:React.FormEvent)=>{e.preventDefault();setSaved(true)}
 return <div>
  <div className="flex items-center gap-3"><Link href="/admin/settings" className="flex size-8 items-center justify-center border border-neutral-200 bg-white text-neutral-500 hover:text-neutral-950" aria-label="Kembali"><ArrowLeft className="size-4"/></Link><PageHeader title="Profil showroom" description="Perubahan tampil di halaman publik setelah disimpan." /></div>
  <form id="showroom-form" onSubmit={onSubmit} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
   <div className="flex flex-col gap-5">
    <Section title="Identitas"><div className="grid gap-4 sm:grid-cols-2"><Field label="Nama showroom" value={form.name} onChange={v=>set({name:v})}/><Field label="Tagline" value={form.tagline} onChange={v=>set({tagline:v})}/><div className="sm:col-span-2"><Field label="Deskripsi" value={form.description} onChange={v=>set({description:v})}/></div><Field label="Logo URL" value={form.logoUrl} onChange={v=>set({logoUrl:v})} placeholder="https://..."/><Field label="Hero image URL" value={form.heroImageUrl} onChange={v=>set({heroImageUrl:v})} placeholder="photo-..."/></div></Section>
    <Section title="Brand"><div className="grid gap-4 sm:grid-cols-2"><Field label="Warna utama" value={form.colors.primary} onChange={v=>setNested('colors',{primary:v})} type="color"/><Field label="Warna sekunder" value={form.colors.secondary} onChange={v=>setNested('colors',{secondary:v})} type="color"/></div>{contrast(form.colors.primary)==='light'&&<div className="mt-4 flex items-start gap-2 border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"><TriangleAlert className="mt-0.5 size-4 shrink-0"/>Warna utama cukup terang. Pastikan teks di atasnya tetap memiliki kontras yang mudah dibaca.</div>}</Section>
    <Section title="Kontak"><div className="grid gap-4 sm:grid-cols-2"><Field label="Telepon" value={form.contact.phone} onChange={v=>setNested('contact',{phone:v})}/><Field label="WhatsApp" value={form.contact.whatsapp} onChange={v=>setNested('contact',{whatsapp:v})}/><Field label="Email" value={form.contact.email} onChange={v=>setNested('contact',{email:v})}/><Field label="Alamat jalan" value={form.address.street} onChange={v=>setNested('address',{street:v})}/><Field label="Kota" value={form.address.city} onChange={v=>setNested('address',{city:v})}/><Field label="Jam buka" value={form.address.openingHours} onChange={v=>setNested('address',{openingHours:v})}/></div></Section>
    <Section title="Sosial media"><div className="grid gap-4 sm:grid-cols-3"><Field label="Instagram" value={form.social.instagram||''} onChange={v=>setNested('social',{instagram:v})} placeholder="@username"/><Field label="TikTok" value={form.social.tiktok||''} onChange={v=>setNested('social',{tiktok:v})} placeholder="@username"/><Field label="Facebook" value={form.social.facebook||''} onChange={v=>setNested('social',{facebook:v})} placeholder="facebook.com/..."/></div></Section>
    <Section title="SEO"><div className="flex flex-col gap-4"><Field label="SEO title" value={form.seo.title} onChange={v=>setNested('seo',{title:v})}/><Field label="SEO description" value={form.seo.description} onChange={v=>setNested('seo',{description:v})}/></div></Section>
   </div>
   <aside className="order-first xl:sticky xl:top-24 xl:order-none xl:self-start"><details className="border border-neutral-200 bg-white" open><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between border-b border-neutral-200 px-5 py-4"><div><p className="text-sm font-bold">Live preview</p><p className="text-xs text-neutral-500">Tampilan publik</p></div><Eye className="size-4 text-neutral-400" /></summary><div className="p-4"><div className="relative flex h-40 flex-col justify-end overflow-hidden p-5" style={{backgroundImage:`linear-gradient(0deg, ${form.colors.secondary} 0%, transparent 75%), url(${form.heroImageUrl.startsWith('http')?form.heroImageUrl:`https://images.unsplash.com/${form.heroImageUrl}?auto=format&fit=crop&w=800&q=70`})`,backgroundSize:'cover',backgroundPosition:'center'}}><p className="relative text-xs font-semibold uppercase tracking-widest text-white/70">{form.name}</p><h3 className="relative mt-1 whitespace-pre-line text-xl font-bold text-white">{form.hero.headline}</h3></div><div className="mt-4 border border-neutral-200 p-4"><p className="text-xs text-neutral-500">Unit pilihan</p><p className="mt-1 font-bold">Toyota Fortuner</p><p className="mt-1 text-sm font-semibold" style={{color:form.colors.primary}}>Rp 485.000.000</p></div><div className="mt-5 border-t border-neutral-100 pt-4"><p className="mb-2 text-xs font-semibold text-neutral-500">Google preview</p><p className="truncate text-sm text-blue-700">{form.seo.title}</p><p className="text-xs text-green-700">primaauto.id</p><p className="mt-1 line-clamp-2 text-xs text-neutral-500">{form.seo.description}</p></div></div></details></aside>
  </form>
  <div className="sticky bottom-0 z-10 mt-6 flex items-center justify-between border border-neutral-200 bg-white/95 p-3 shadow-lg backdrop-blur"><p className="hidden text-xs text-neutral-500 sm:block">{saved?'Semua perubahan tersimpan':'Ada perubahan yang belum disimpan'}</p><div className="ml-auto flex gap-2"><button type="button" onClick={()=>{setForm(initial);setSaved(true)}} className="h-9 border border-neutral-200 px-3 text-sm font-medium">Batal</button><button type="submit" form="showroom-form" onClick={onSubmit} className="flex h-9 items-center gap-2 bg-neutral-950 px-4 text-sm font-semibold text-white"><Save className="size-4"/>Simpan perubahan</button></div></div>
 </div>
}
