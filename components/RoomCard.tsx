'use client'

type CtaConfig = {
  label: string
  onClick?: () => void
  href?: string
  target?: string
  rel?: string
  disabled?: boolean
}

export default function RoomCard({
  title,
  subtitle,
  description,
  image,
  galleryImages,
  imageAlt,
  price,
  hasDates,
  priceUnavailable = false,
  priceSuffix = 'per night',
  badge,
  cornerBadge,
  features,
  accent = 'premium',
  onImageClick,
  onGalleryImageClick,
  facilitiesAction,
  expiryNote,
  availabilityMessage,
  availabilityTone = 'neutral',
  primaryCta,
  secondaryCta,
}: {
  title: string
  subtitle?: string
  description?: string | null
  image?: string | null
  galleryImages?: string[]
  imageAlt: string
  price: number | null
  hasDates: boolean
  priceUnavailable?: boolean
  priceSuffix?: string
  badge?: string
  cornerBadge?: string
  features?: string[]
  accent?: 'premium' | 'deluxe'
  onImageClick?: () => void
  onGalleryImageClick?: (index: number) => void
  facilitiesAction?: { label: string; onClick: () => void }
  expiryNote?: string | null
  availabilityMessage?: string | null
  availabilityTone?: 'success' | 'warning' | 'danger' | 'neutral'
  primaryCta: CtaConfig
  secondaryCta?: CtaConfig
}) {
  const isPremium = accent === 'premium'
  const accentColor = isPremium ? '#c9a14a' : '#3b82f6'

  const PrimaryTag = primaryCta.href ? 'a' : 'button'
  const SecondaryTag = secondaryCta?.href ? 'a' : 'button'
  const availabilityToneClass = availabilityTone === 'success'
    ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200'
    : availabilityTone === 'warning'
      ? 'border-amber-500/25 bg-amber-500/10 text-amber-100'
      : availabilityTone === 'danger'
        ? 'border-red-500/25 bg-red-500/10 text-red-200'
        : 'border-white/10 bg-white/[0.03] text-white/65'

  return (
    <div
      className="group flex flex-col overflow-hidden rounded-3xl border transition-all duration-300 hover:shadow-2xl"
      style={{ background: 'rgba(255,255,255,0.025)', borderColor: isPremium ? 'rgba(201,161,74,0.2)' : 'rgba(255,255,255,0.08)' }}
    >
      <div className="relative h-56 flex-shrink-0 overflow-hidden">
        {image ? (
          <img
            src={image}
            alt={imageAlt}
            className={`absolute inset-0 h-full w-full object-cover transition-transform duration-500 ${onImageClick ? 'cursor-pointer' : ''} group-hover:scale-105`}
            onClick={onImageClick}
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-white/5 text-6xl">{isPremium ? 'P' : 'D'}</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {badge && (
          <div className="absolute left-3 top-3">
            <span className={`rounded-full px-3 py-1.5 text-xs font-bold backdrop-blur ${isPremium ? 'bg-gradient-to-r from-[#c9a14a] to-[#e6c87a] text-black' : 'bg-blue-500/80 text-white'}`}>
              {badge}
            </span>
          </div>
        )}

        {subtitle && (
          <div className="absolute right-3 top-3">
            <span className={`rounded-full border px-3 py-1.5 text-xs font-bold backdrop-blur ${isPremium ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' : 'bg-white/10 border-white/20 text-white/80'}`}>
              {subtitle}
            </span>
          </div>
        )}

        {cornerBadge && (
          <div className="absolute bottom-3 left-3">
            <span className="rounded-full bg-gradient-to-r from-red-500 to-orange-500 px-3 py-1.5 text-xs font-bold text-white shadow-lg">
              {cornerBadge}
            </span>
          </div>
        )}

        {galleryImages && galleryImages.length > 1 ? (
          <div className="absolute bottom-3 right-3 flex max-w-[78%] items-center gap-2 rounded-2xl border border-white/15 bg-black/55 p-1.5 shadow-2xl backdrop-blur-md">
            <button
              type="button"
              onClick={onImageClick}
              className="mr-1 flex h-10 items-center gap-1.5 rounded-xl bg-white/10 px-3 text-xs font-semibold text-white transition hover:bg-white/15"
            >
              <span className="text-[#c9a14a]">View</span>
              <span>{galleryImages.length} Photos</span>
            </button>
            <div className="hidden items-center gap-1.5 sm:flex">
              {galleryImages.slice(0, 4).map((galleryImage, index) => (
                <button
                  key={`${galleryImage}-${index}`}
                  type="button"
                  onClick={() => onGalleryImageClick?.(index)}
                  className="relative h-10 w-12 flex-shrink-0 overflow-hidden rounded-xl border border-white/15 transition hover:scale-105 hover:border-[#c9a14a]/70"
                >
                  <img src={galleryImage} alt={`${imageAlt} ${index + 1}`} className="h-full w-full object-cover" loading="lazy" />
                </button>
              ))}
              {galleryImages.length > 4 ? (
                <button
                  type="button"
                  onClick={() => onGalleryImageClick?.(4)}
                  className="flex h-10 min-w-[42px] items-center justify-center rounded-xl border border-white/15 bg-white/5 px-2 text-xs font-semibold text-white/80 transition hover:border-[#c9a14a]/70 hover:text-white"
                >
                  +{galleryImages.length - 4}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col justify-between p-6">
        <div>
          <div className="mb-3 flex items-start justify-between gap-4">
            <div>
              <h2 className="font-playfair text-xl text-white">{title}</h2>
            </div>
            <div className="flex-shrink-0 text-right">
              {hasDates && price !== null && !priceUnavailable ? (
                <>
                  <div className="text-2xl font-bold" style={{ color: accentColor }}>Rs. {price.toLocaleString()}</div>
                  <div className="text-xs text-white/35">{priceSuffix}</div>
                </>
              ) : priceUnavailable ? (
                <>
                  <div className="text-sm font-semibold text-white/75">Price not available</div>
                  <div className="text-xs text-white/35">Try different dates</div>
                </>
              ) : (
                <>
                  <div className="text-sm font-semibold text-white/75">Select dates to view price</div>
                  <div className="text-xs text-white/35">Live pricing appears after selection</div>
                </>
              )}
            </div>
          </div>

          {description && <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-white/55">{description}</p>}

          {features?.length ? (
            <div className="mb-4 flex flex-wrap gap-3 text-xs text-white/50">
              {features.map((feature) => (
                <span key={feature} className="flex items-center gap-1">{feature}</span>
              ))}
            </div>
          ) : null}

          {facilitiesAction ? (
            <button
              type="button"
              onClick={facilitiesAction.onClick}
              className="mt-1 text-xs transition-all hover:underline"
              style={{ color: isPremium ? 'rgba(201,161,74,0.7)' : 'rgba(96,165,250,0.7)' }}
            >
              {facilitiesAction.label}
            </button>
          ) : null}
        </div>

        {expiryNote ? (
          <div className="mt-4 rounded-xl px-3 py-2 text-xs font-medium" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'rgba(248,113,113,0.9)' }}>
            {expiryNote}
          </div>
        ) : null}

        {availabilityMessage ? (
          <div className={`mt-4 rounded-xl border px-3 py-2 text-xs font-medium ${availabilityToneClass}`}>
            {availabilityMessage}
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <PrimaryTag
            {...(primaryCta.href ? { href: primaryCta.href, target: primaryCta.target, rel: primaryCta.rel } : { type: 'button', onClick: primaryCta.onClick })}
            className="min-w-[140px] flex-1 rounded-xl py-3 text-center text-sm font-bold transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: isPremium ? 'linear-gradient(135deg,#c9a14a,#e6c87a)' : '#3b82f6', color: isPremium ? '#000' : '#fff' }}
            {...(!primaryCta.href ? { disabled: primaryCta.disabled } : {})}
          >
            {primaryCta.label}
          </PrimaryTag>

          {secondaryCta ? (
            <SecondaryTag
              {...(secondaryCta.href ? { href: secondaryCta.href, target: secondaryCta.target, rel: secondaryCta.rel } : { type: 'button', onClick: secondaryCta.onClick })}
              className="flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all"
              style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: '#4ade80' }}
            >
              {secondaryCta.label}
            </SecondaryTag>
          ) : null}
        </div>
      </div>
    </div>
  )
}
