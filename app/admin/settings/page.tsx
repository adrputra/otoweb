import Link from 'next/link'
import {ArrowRight, Globe2, Palette, UserRound} from 'lucide-react'
import {PageHeader} from '@/components/admin-shell'

const tabs = [
  {href:'/admin/settings', label:'Showroom', icon:Palette, active:true},
  {href:'#', label:'Domain', icon:Globe2, disabled:true},
  {href:'#', label:'Akun', icon:UserRound, disabled:true},
]

export default function SettingsPage(){
  return <div>
    <PageHeader title="Pengaturan" description="Kelola identitas dan tampilan showroom Anda." />
    <div className="mb-6 flex overflow-x-auto border-b border-neutral-200">
      {tabs.map(({href,label,icon:Icon,active,disabled}) => disabled ? <span key={label} className="flex shrink-0 items-center gap-2 border-b-2 border-transparent px-4 py-3 text-sm font-medium text-neutral-500"> <Icon className="size-4" />{label}<span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">Segera hadir</span></span> : <Link key={label} href={href} className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium ${active?'border-neutral-950 text-neutral-950':'border-transparent text-neutral-500'}`}><Icon className="size-4" />{label}</Link>)}
    </div>
    <Link href="/admin/settings/showroom" className="group flex max-w-2xl items-center justify-between border border-neutral-200 bg-white p-5 transition hover:border-neutral-400">
      <div><p className="text-sm font-semibold">Profil showroom</p><p className="mt-1 text-sm text-neutral-500">Nama, kontak, warna brand, SEO, dan tampilan hero.</p></div><ArrowRight className="size-5 text-neutral-500 transition group-hover:translate-x-1" />
    </Link>
  </div>
}
