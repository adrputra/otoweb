export const formatRupiah=(n:number)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n)
export const formatKm=(n:number)=>`${new Intl.NumberFormat('id-ID').format(n)} km`
export const formatDate=(s:string)=>new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'long',year:'numeric'}).format(new Date(s))
export const whatsappLink=(phone:string,message:string)=>`https://wa.me/${phone.replace(/\D/g,'')}?text=${encodeURIComponent(message)}`
