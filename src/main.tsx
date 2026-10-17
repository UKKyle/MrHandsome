import React, { FormEvent, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, Menu, Phone, Star, X } from 'lucide-react';
import './styles.css';
const heroImage = '/images/template-hero.svg';
const workImage1 = '/images/template-cut-1.svg';
const workImage2 = '/images/template-cut-2.svg';
const workImage3 = '/images/template-cut-3.svg';
const workImage4 = '/images/template-cut-4.svg';

const business = {
  name: 'Your Barbershop',
  phone: 'Your shop telephone',
  phoneHref: '#contact',
  address: "Your shop address",
  rating: 0,
  reviews: 0,
  facebook: '#contact',
  googleMaps: "#contact",
  googleEmbed: "",
  heroImage,
  hours: [
    ['Monday–Friday', 'Hours to be confirmed'],
    ['Saturday', 'Hours to be confirmed'],
    ['Sunday', 'Hours to be confirmed'],
  ],
};

const services = [
  ['Haircuts', 'Classic and modern cuts, finished to suit your style.'],
  ['Skin fades', 'Sharp fades and tapers with clean blending and detail.'],
  ['Hair & beard', 'A complete tidy-up with haircut, trim and beard shape.'],
  ['Wet & dry shave', 'Traditional shaving options for a clean finish.'],
];


const workImages = [
  {
    src: workImage1,
    alt: 'Barber styling a finished haircut at Your Barbershop',
  },
  {
    src: workImage2,
    alt: 'Rear fade haircut at Your Barbershop',
  },
  {
    src: workImage3,
    alt: 'Fade and beard finish at Your Barbershop',
  },
  {
    src: workImage4,
    alt: 'Side-part haircut finished at Your Barbershop',
  },
];

const reviews = [
  ['“Add a verified review before launch.”', 'Customer review'],
  ['“Replace with a genuine customer quote.”', 'Customer review'],
  ['“Only publish attributed, verified reviews.”', 'Customer review'],
];

function App() {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem('mh-preview') === '1');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<{date:string;time:string}[]>([]);
  const [slotsLoaded, setSlotsLoaded] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [bookingTime, setBookingTime] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [acceptedArrivalTerms, setAcceptedArrivalTerms] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [customerEmail,setCustomerEmail] = useState('');
  const [emailBooking,setEmailBooking] = useState(false);
  const [previewOnly,setPreviewOnly] = useState(true);
  const [turnstileKey,setTurnstileKey] = useState('');
  const [turnstileToken,setTurnstileToken] = useState('');
  const turnstileContainer=React.useRef<HTMLDivElement>(null);
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [bookingConfirmation, setBookingConfirmation] = useState<{date:string;time:string;name:string;emailSent?:boolean}|null>(null);
  const workReelRef = React.useRef<HTMLDivElement>(null);
  const confirmationDialogRef = React.useRef<HTMLDivElement>(null);
  const [confirmationOpen,setConfirmationOpen] = useState(false);
  const selectionRef=React.useRef<{date:string|null;time:string|null}>({date:null,time:null});
  selectionRef.current={date:selectedDate,time:bookingTime};

  useEffect(() => {
    document.title = unlocked ? 'Your Barbershop — Concept Preview' : 'Private Concept — Your Barbershop';
  }, [unlocked]);


  const unlock = (event: FormEvent) => {
    event.preventDefault();
    if (pin === '0000') {
      sessionStorage.setItem('mh-preview', '1');
      setUnlocked(true);
      setError('');
      return;
    }
    setError('That PIN is not correct. Please check the code sent with your preview.');
  };

  const go = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMenuOpen(false);
  };

  const refreshSlots = async () => {
    const response = await fetch('/api/slots', {cache:'no-store'});
    if (!response.ok) throw new Error('Unable to refresh appointments');
    const data:{slots:{date:string;time:string}[]} = await response.json();
    const slots=Array.isArray(data.slots)?data.slots:[];
    setAvailableSlots(slots);
    setSelectedDate(previous=>previous && slots.some(item=>item.date===previous)?previous:(slots[0]?.date??null));
    const selected=selectionRef.current;
    if(selected.time && !slots.some(item=>item.date===selected.date&&item.time===selected.time))setBookingTime(null);
    setSlotsLoaded(true);
    return slots;
  };
  useEffect(() => {
    let active=true;
    const update=async()=>{try{if(active)await refreshSlots();}catch{if(active)setSlotsLoaded(true);}};
    void update();
    const interval=window.setInterval(()=>{if(document.visibilityState==='visible')void update();},60000);
    const onFocus=()=>void update();
    window.addEventListener('focus',onFocus);
    return ()=>{active=false;window.clearInterval(interval);window.removeEventListener('focus',onFocus);};
  }, []);
  useEffect(()=>{
    if(!confirmationOpen)return;
    const previous=document.body.style.overflow;
    document.body.style.overflow='hidden';
    confirmationDialogRef.current?.focus();
    const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')setConfirmationOpen(false);};
    document.addEventListener('keydown',onKey);
    return ()=>{document.body.style.overflow=previous;document.removeEventListener('keydown',onKey);};
  },[confirmationOpen]);

  useEffect(()=>{
    let active=true;
    fetch('/api/booking-config',{cache:'no-store'}).then(r=>r.json()).then((v:{emailEnabled?:boolean;turnstileSiteKey?:string})=>{
      if(!active)return;
      setPreviewOnly(v.previewOnly!==false);
      setEmailBooking(v.emailEnabled===true);
      setTurnstileKey(v.emailEnabled&&v.turnstileSiteKey?v.turnstileSiteKey:'');
    }).catch(()=>{});
    return ()=>{active=false};
  },[]);
  useEffect(()=>{
    if(!emailBooking||!turnstileKey||!unlocked)return;
    let widgetId:string|undefined;let cancelled=false;
    const w=window as typeof window & {turnstile?:{render:(el:HTMLElement,opts:Record<string,unknown>)=>string;remove:(id:string)=>void}};
    const render=()=>{if(cancelled||!turnstileContainer.current||!w.turnstile)return;
      widgetId=w.turnstile.render(turnstileContainer.current,{sitekey:turnstileKey,theme:'dark',appearance:'interaction-only',callback:(token:string)=>setTurnstileToken(token),'expired-callback':()=>setTurnstileToken(''),'error-callback':()=>setTurnstileToken('')});
    };
    let script=document.querySelector<HTMLScriptElement>('script[data-booking-turnstile]');
    if(!script){script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.defer=true;script.dataset.bookingTurnstile='1';document.head.appendChild(script);}
    if(w.turnstile)render();else script.addEventListener('load',render,{once:true});
    return ()=>{cancelled=true;script?.removeEventListener('load',render);if(widgetId&&w.turnstile)w.turnstile.remove(widgetId);};
  },[emailBooking,turnstileKey,unlocked]);
  const bookingDates=[...new Set(availableSlots.map(slot=>slot.date))];
  const visibleTimes=availableSlots.filter(slot=>slot.date===(selectedDate ?? bookingDates[0]));

  const confirmBooking = async (event:FormEvent) => {
    event.preventDefault();
    if(!selectedDate || !bookingTime || !acceptedArrivalTerms || customerName.trim().length<2 || (previewOnly && !customerEmail.includes('@')) || (!previewOnly && emailBooking && (!customerEmail.includes('@') || !turnstileToken))) return;
    if(previewOnly){setBookingConfirmation({date:selectedDate!,time:bookingTime!,name:customerName.trim()});setConfirmationOpen(true);return;}
    setBookingSubmitting(true);setBookingError('');
    try {
      const res=await fetch('/api/bookings',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({date:selectedDate,time:bookingTime,name:customerName.trim(),accepted_terms:true,...(emailBooking?{email:customerEmail.trim(),turnstile_token:turnstileToken}:{})})});
      const data=await res.json();
      if(!res.ok)throw new Error(data.error||'Unable to reserve appointment');
      setBookingConfirmation({date:selectedDate,time:bookingTime,name:customerName.trim(),emailSent:emailBooking?data.emailSent===true:undefined});
      setConfirmationOpen(true);
      setAvailableSlots(old=>old.filter(x=>!(x.date===selectedDate&&x.time===bookingTime)));
      setBookingTime(null);setCustomerName('');setCustomerEmail('');setAcceptedArrivalTerms(false);setTurnstileToken('');
    }catch(e){setBookingError(e instanceof Error?e.message:'Unable to book. Please try again.');try{await refreshSlots();}catch{ /* Keep the error visible if refresh fails. */ }}
    finally{setBookingSubmitting(false);}
  };

  const moveWorkReel = (direction: -1 | 1) => {
    const reel = workReelRef.current;
    if (!reel) return;
    const card = reel.querySelector<HTMLElement>('.work-card');
    reel.scrollBy({
      left: (card?.offsetWidth ?? 420) * direction + 18 * direction,
      behavior: 'smooth',
    });
  };

  if (!unlocked) {
    return (
      <main className="gate">
        <section className="gate-panel">
          <p className="gate-brand">YOUR BARBERSHOP</p>
          <h1>Private website preview</h1>
          <p>This independent concept has been prepared for Your Barbershop. It is not the live business website.</p>
          <form onSubmit={unlock}>
            <label htmlFor="pin">Preview PIN</label>
            <div className="pin-row">
              <input id="pin" value={pin} onChange={e => setPin(e.target.value)} inputMode="numeric" autoComplete="off" placeholder="4 digits" maxLength={4} />
              <button type="submit">Enter</button>
            </div>
            {error && <p className="gate-error">{error}</p>}
          </form>
        </section>
      </main>
    );
  }

  return (
    <div className="site">
      <a className="skip-link" href="#booking">Skip to booking</a>
      <div className="preview-note preview-ticker" role="region" aria-label="Your Barbershop announcements">
        <div className="preview-ticker-track" aria-hidden="true">
          {[0,1,2,3].map(i => <div className="preview-ticker-set" key={i}>
            <span>BOOKINGS AVAILABLE</span><span className="ticker-dot">✦</span>
            <span>YOUR TRUSTED NEIGHBOURHOOD BARBER</span><span className="ticker-dot">✦</span>
            <span>PRIVATE CONCEPT WEBSITE</span><span className="ticker-dot">✦</span>
          </div>)}
        </div>
        <span className="sr-only">Bookings available. Your trusted neighbourhood barber. Private concept website, not the live business website.</span>
      </div>

      <header>
        <button className="brand" onClick={() => go('top')}>YOUR BARBERSHOP</button>
        <nav className={menuOpen ? 'open' : ''}>
          <button onClick={() => go('work')}>Gallery</button>
          <button onClick={() => go('booking')}>Availability</button>
          <button onClick={() => go('reviews')}>Reviews</button>
          <button onClick={() => go('visit')}>Visit</button>
          <a href={business.facebook} target="_blank" rel="noreferrer">Facebook</a>
        </nav>
        <a className="header-cta" href="#booking">BOOK APPOINTMENT</a>
        <a className="mobile-header-book" href="#booking" aria-label="View appointment availability"><CalendarDays size={15} aria-hidden="true" /> <span>Book</span></a>
        <button className="menu-button" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} onClick={() => setMenuOpen(v => !v)}>
          {menuOpen ? <X /> : <Menu />}
        </button>
      </header>

      <main>
        <section className="hero" id="top">
          <div className="hero-copy">
            <div className="hero-top"><p className="hero-location">KING'S NORTON · BIRMINGHAM</p>
            <h1>MR<br/>HANDSOME</h1></div>
            <div className="hero-bottom"><p className="hero-service-line">Haircuts · Fades · Beards · Shaves</p>
            <div className="rating-row">
              <div className="stars">{[0,1,2,3,4].map(i => <Star key={i} size={17} fill="currentColor" />)}</div>
              <strong>{business.rating||'—'}</strong>
              <span>{business.reviews||'—'} Google reviews</span>
            </div>
            <div className="hero-actions">
              <a className="hero-primary" href="#booking"><CalendarDays size={16} /> Book appointment</a>
              <a className="hero-secondary" href={business.googleMaps} target="_blank" rel="noreferrer"><MapPin size={16} /> Directions</a>
            </div></div>
          </div>

          <figure className="hero-image">
            <img src={business.heroImage} alt="Hair styling at Your Barbershop barbershop" />
          </figure>
        </section>

        <section className="trust-strip" aria-label="Why visit Your Barbershop">
          <a className="trust-item trust-reviews" href={business.googleMaps} target="_blank" rel="noopener noreferrer" aria-label={`Find Your Barbershop on Google Maps. Rating ${business.rating||'—'} out of 5 from ${business.reviews||'—'} Google reviews`}>
            <span className="trust-icon trust-google" aria-hidden="true">G</span>
            <span className="trust-copy">
              <span className="trust-primary"><strong>{business.rating||'—'}<small>/5</small></strong><span className="trust-stars" aria-label="Five stars">{[0,1,2,3,4].map(i => <Star key={i} size={15} fill="currentColor" />)}</span></span>
              <span className="trust-detail">{business.reviews||'—'} customer reviews <ChevronRight size={14} aria-hidden="true" /></span>
            </span>
          </a>
          <a className="trust-item" href="#booking" aria-label="Open every day. View appointment availability and book online">
            <span className="trust-icon" aria-hidden="true"><CalendarDays size={23} strokeWidth={1.6} /></span>
            <span className="trust-copy">
              <span className="trust-primary"><strong>Mon–Sun</strong></span>
              <span className="trust-detail">See appointments · Book online</span>
            </span>
          </a>
          <a className="trust-item" href={business.googleMaps} target="_blank" rel="noopener noreferrer">
            <span className="trust-icon" aria-hidden="true"><MapPin size={23} strokeWidth={1.6} /></span>
            <span className="trust-copy">
              <span className="trust-primary"><strong>25 The Green</strong></span>
              <span className="trust-detail">Your location · Directions <ChevronRight size={14} aria-hidden="true" /></span>
            </span>
          </a>
        </section>

        <section className="work-showcase" id="work">
          <div className="work-head">
            <div>
              <h2>Recent cuts.</h2>
            </div>
            <div className="work-controls" aria-label="Browse recent work">
              <button type="button" onClick={() => moveWorkReel(-1)} aria-label="Previous image">
                <ChevronLeft size={20} />
              </button>
              <button type="button" onClick={() => moveWorkReel(1)} aria-label="Next image">
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          <p className="work-swipe-hint">Swipe to see more work <ChevronRight size={14} aria-hidden="true"/></p>
          <div className="work-reel" ref={workReelRef}>
            {workImages.map((image, index) => (
              <figure className="work-card" key={image.src}>
                <img src={image.src} alt={image.alt} loading={index === 0 ? 'eager' : 'lazy'} />
              </figure>
            ))}
          </div>
        </section>

        <section className="reviews" id="reviews">
          <div className="reviews-head">
            <div>
              <h2>A reputation already earned.</h2>
            </div>
            <div className="review-score">
              <strong>{business.rating||'—'}</strong>
              <div>
                <div className="stars">{[0,1,2,3,4].map(i => <Star key={i} size={18} fill="currentColor" />)}</div>
                <span>{business.reviews||'—'} Google reviews</span>
              </div>
            </div>
          </div>

          <div className="review-wall">
            {reviews.map(([quote, name], index) => (
              <blockquote className={index === 0 ? 'review-featured' : ''} key={name}>
                <div className="quote-stars">{[0,1,2,3,4].map(i => <Star key={i} size={13} fill="currentColor" />)}</div>
                <p>{quote}</p>
                <cite>{name}<span>Google review</span></cite>
              </blockquote>
            ))}
          </div>

          <div className="reviews-cta">
            <span>Read more customer feedback</span>
            <a href={business.googleMaps} target="_blank" rel="noreferrer">View Google profile</a>
          </div>
        </section>

        <section className="services" id="services">
          <div className="services-shell">
            <div className="services-copy">
              <h2>Book your next visit.</h2>
            </div>
            <div className="booking-preview simple-booking" id="booking" aria-label="Upcoming appointment availability">
              <div className="booking-preview-head">
                <div><h3>Choose your appointment.</h3></div>
              </div>
              <div className="booking-phone-option"><span>Prefer to book by phone?</span><a href={business.phoneHref} aria-label={`Call Your Barbershop on ${business.phone}`}><Phone size={16}/> <span>{business.phone}</span></a></div>
              {!bookingConfirmation && (!slotsLoaded ? <p className="simple-booking-empty">Checking upcoming availability…</p> :
                bookingDates.length===0 ? <div className="simple-booking-empty">
                  <CalendarDays size={27}/><p>No appointment times have been published yet.</p>
                  <p>Please contact the shop for the next available appointment.</p>
                </div> : <>
                  <p className="simple-booking-label">Choose a day</p>
                  <div className="simple-booking-days">
                    {bookingDates.map(date=><button type="button" key={date} className={date===(selectedDate??bookingDates[0])?'selected':''} aria-pressed={date===(selectedDate??bookingDates[0])} onClick={()=>{setSelectedDate(date);setBookingTime(null);}}>
                      <span>{new Date(date+'T12:00:00').toLocaleDateString('en-GB',{weekday:'short'})}</span>
                      <strong>{new Date(date+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</strong>
                    </button>)}
                  </div>
                  <p className="simple-booking-label">Available times</p>
                  <div className="simple-booking-times">
                    {visibleTimes.map(slot=><button type="button" key={slot.time} className={bookingTime===slot.time?'selected':''} aria-pressed={bookingTime===slot.time} onClick={()=>setBookingTime(slot.time)}>{slot.time}</button>)}
                  </div>
                </>
              )}
              {bookingConfirmation ? <div className="booking-success" role="status">
                <div className="booking-success-icon">✓</div>
                <h4>You're booked in.</h4>
                <p>{bookingConfirmation.name} · {new Date(bookingConfirmation.date+'T12:00:00').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})} at {bookingConfirmation.time}</p>
                <p>Please arrive on time. No email or text confirmation is sent, so keep a note of your appointment.</p>
                <button type="button" onClick={()=>setBookingConfirmation(null)}>Book another appointment</button>
              </div> : <form className="simple-booking-form" onSubmit={confirmBooking}>
                {bookingTime && selectedDate && <div className="booking-selection-summary"><span>Your appointment</span><strong>{new Date(selectedDate+'T12:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'long'})} · {bookingTime}</strong></div>}
                <label htmlFor="customer-booking-name">Your name</label>
                <input id="customer-booking-name" value={customerName} onChange={e=>setCustomerName(e.target.value)} placeholder="Full name" autoComplete="name" maxLength={80} minLength={2} required/>
                {(previewOnly||emailBooking) && <>
                  <label htmlFor="customer-booking-email">Email address</label>
                  <input id="customer-booking-email" className="booking-email-input" type="email" value={customerEmail} onChange={e=>setCustomerEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" maxLength={254} required/>
                  <p className="booking-email-hint">{previewOnly?'Demo only — no email is sent or stored. In the live version, confirmation details are emailed here.':"We'll email your appointment details here. No account needed."}</p>
                  {!previewOnly && <div className="booking-turnstile" ref={turnstileContainer} aria-label="Booking security verification"/>}
                </>}
                <div className="booking-agreement terms-agreement">
                  <label htmlFor="booking-accept-terms"><input id="booking-accept-terms" type="checkbox" checked={acceptedArrivalTerms} onChange={e=>setAcceptedArrivalTerms(e.target.checked)} required/><span>I have read and accept the</span></label>
                  <button type="button" className="terms-link" onClick={()=>setTermsOpen(true)} aria-haspopup="dialog">Terms &amp; Conditions</button>
                </div>
                {bookingError&&<p className="booking-form-error" role="alert">{bookingError}</p>}
                <button className="booking-submit" type="submit" disabled={!bookingTime||!acceptedArrivalTerms||customerName.trim().length<2||(previewOnly&&!customerEmail.includes('@'))||(!previewOnly&&emailBooking&&(!customerEmail.includes('@')||!turnstileToken))||bookingSubmitting}>{bookingSubmitting?'Booking…':previewOnly?'See booking preview':'Confirm appointment'}</button>
                <p className="booking-privacy">{previewOnly?'Concept preview only. No reservation is created, and the name or email entered here is not sent to the booking server.':<>Your booking details are stored so the shop can manage your appointment. To ask about your information or cancel, call <a href={business.phoneHref}>{business.phone}</a>. {emailBooking?'We will attempt to send an email confirmation.':'No email or SMS is sent.'}</>}</p>
              </form>}

            </div>
          </div>
        </section>

        <section className="visit" id="visit">
          <div className="map-wrap">
            <iframe title="Your Barbershop location" src={business.googleEmbed} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          </div>

          <div className="visit-panel">
            <p className="section-kicker">Visit the shop</p>
            <h2>25 The Green</h2>
            <p className="visit-address">{business.address}</p>
            <div className="visit-actions">
              <a className="visit-primary" href={business.googleMaps} target="_blank" rel="noreferrer"><MapPin size={16} /> Get directions</a>
              <a className="visit-secondary" href="#booking"><CalendarDays size={16} /> Book appointment</a>
            </div>
            <div className="hours">
              <h3>Opening hours</h3>
              {business.hours.map(([day,time]) => <div key={day}><span>{day}</span><strong>{time}</strong></div>)}
              {previewOnly && <p className="preview-detail-note">Hours are indicative for this concept and will be confirmed before launch.</p>}
            </div>
          </div>
        </section>
      </main>

      <footer>
        <strong>YOUR BARBERSHOP</strong>
        <span>Your shop address</span>
        <div className="footer-links"><a href={business.phoneHref}>Call {business.phone}</a><a href={business.googleMaps} target="_blank" rel="noreferrer">Directions</a><a href={business.facebook} target="_blank" rel="noreferrer">Facebook</a></div>
      </footer>

      {termsOpen && <div className="terms-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setTermsOpen(false);}}>
        <div className="terms-dialog" role="dialog" aria-modal="true" aria-labelledby="terms-heading">
          <div className="terms-dialog-head"><div><span className="terms-eyebrow">YOUR BARBERSHOP · APPOINTMENTS</span><h2 id="terms-heading">Terms &amp; Conditions</h2></div><button type="button" className="terms-close" onClick={()=>setTermsOpen(false)} aria-label="Close terms">×</button></div>
          <div className="terms-dialog-body">
            <h3>Arriving for your appointment</h3><p>Please arrive at your selected time. If you arrive late or miss your appointment, the barber may be unable to complete your service and may ask you to wait for the next available walk-in opportunity.</p>
            <h3>Changing or cancelling</h3><p>If you need to change or cancel your appointment, please telephone the shop on <a href={business.phoneHref}>{business.phone}</a> as soon as possible. Online changes and cancellations are not currently offered.</p>
            <h3>Your details and confirmation</h3><p>When live bookings are enabled, your name, email address and appointment details are used to arrange and manage the appointment. Your email address is also used to send a booking confirmation when email delivery is available. This is not consent to marketing emails.</p>
            <h3>About this preview</h3><p>{previewOnly?'This website is a private demonstration. Completing the form will show an example confirmation only: no appointment is made, no email is sent and your details are not submitted to the booking service.':'Your appointment is only confirmed once you receive the booking confirmation on screen. Email delivery may be delayed or unavailable.'}</p>
          </div>
          <button type="button" className="terms-done" onClick={()=>setTermsOpen(false)}>Close terms</button>
        </div>
      </div>}
      {bookingConfirmation && confirmationOpen && <div className="booking-modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setConfirmationOpen(false);}}>
        <div className="booking-modal" role="dialog" aria-modal="true" aria-labelledby="booking-confirmed-title" tabIndex={-1} ref={confirmationDialogRef}>
          <div className="booking-modal-check" aria-hidden="true">{previewOnly?'i':'✓'}</div>
          <h2 id="booking-confirmed-title">{previewOnly?'Booking preview complete':"You're booked in."}</h2>
          <p className="booking-modal-name">{bookingConfirmation.name}</p>
          <p className="booking-modal-time">{new Date(bookingConfirmation.date+'T12:00:00').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})} at {bookingConfirmation.time}</p>
          <p className="booking-modal-address">Your Barbershop · Your shop address</p>
          <p className="booking-modal-note">{previewOnly?'PREVIEW ONLY — This demonstrates the confirmation customers would see after booking. No appointment has been reserved and no email has been sent.':emailBooking?(bookingConfirmation.emailSent?'A confirmation email is on its way. Please also keep these details.':'Your booking is confirmed, but the email could not be sent. Please save these details.'):'Your appointment is confirmed. No text or email will be sent, so save these details.'}</p>
          <button className="booking-modal-dismiss" onClick={()=>setConfirmationOpen(false)}>Done</button>
        </div>
      </div>}
      <div className="mobile-actions" aria-label="Quick actions">
        <a href="#booking"><CalendarDays size={17} /> Book</a>
        <a href={business.googleMaps} target="_blank" rel="noreferrer"><MapPin size={17} /> Directions</a>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
