import React, { FormEvent, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, Menu, Phone, Star, X } from 'lucide-react';
import './styles.css';
const heroImage = '/images/hero.webp';
const workImage1 = '/images/work-1.webp';
const workImage2 = '/images/work-2.webp';
const workImage3 = '/images/work-3.webp';
const workImage4 = '/images/work-4.webp';

const business = {
  name: 'Mr Handsome',
  phone: '0121 448 3870',
  phoneHref: 'tel:+441214483870',
  address: "25 The Green, King's Norton, Birmingham B38 8SD",
  rating: 4.9,
  reviews: 290,
  facebook: 'https://www.facebook.com/427863107661555/',
  googleMaps: "https://www.google.com/maps/search/?api=1&query=Mr%20Handsome%20Birmingham%2C%2025%20The%20Green%2C%20King%27s%20Norton%2C%20B38%208SD",
  googleEmbed: "https://www.google.com/maps?q=25+The+Green,+King's+Norton,+Birmingham+B38+8SD&output=embed",
  heroImage,
  hours: [
    ['Monday–Friday', '9:30am – 7:00pm'],
    ['Saturday', '8:30am – 5:00pm'],
    ['Sunday', '11:00am – 4:00pm'],
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
    alt: 'Barber styling a finished haircut at Mr Handsome',
  },
  {
    src: workImage2,
    alt: 'Rear fade haircut at Mr Handsome',
  },
  {
    src: workImage3,
    alt: 'Fade and beard finish at Mr Handsome',
  },
  {
    src: workImage4,
    alt: 'Side-part haircut finished at Mr Handsome',
  },
];

const reviews = [
  ['“Always a cracking haircut here.”', 'Dan Craig'],
  ['“Great place for kids as well.”', 'Robbie Hindle'],
  ['“The attention to detail is second to none.”', 'Stuart Jennings'],
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
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [bookingConfirmation, setBookingConfirmation] = useState<{date:string;time:string;name:string}|null>(null);
  const workReelRef = React.useRef<HTMLDivElement>(null);
  const selectionRef=React.useRef<{date:string|null;time:string|null}>({date:null,time:null});
  selectionRef.current={date:selectedDate,time:bookingTime};

  useEffect(() => {
    document.title = unlocked ? 'Mr Handsome — Concept Preview' : 'Private Concept — Mr Handsome';
  }, [unlocked]);


  const unlock = (event: FormEvent) => {
    event.preventDefault();
    if (pin === '4821') {
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
  const bookingDates=[...new Set(availableSlots.map(slot=>slot.date))];
  const visibleTimes=availableSlots.filter(slot=>slot.date===(selectedDate ?? bookingDates[0]));

  const confirmBooking = async (event:FormEvent) => {
    event.preventDefault();
    if(!selectedDate || !bookingTime || !acceptedArrivalTerms || customerName.trim().length<2) return;
    setBookingSubmitting(true);setBookingError('');
    try {
      const res=await fetch('/api/bookings',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({date:selectedDate,time:bookingTime,name:customerName.trim(),accepted_terms:true})});
      const data=await res.json();
      if(!res.ok)throw new Error(data.error||'Unable to reserve appointment');
      setBookingConfirmation({date:selectedDate,time:bookingTime,name:customerName.trim()});
      setAvailableSlots(old=>old.filter(x=>!(x.date===selectedDate&&x.time===bookingTime)));
      setBookingTime(null);setCustomerName('');setAcceptedArrivalTerms(false);
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
          <p className="gate-brand">MR HANDSOME</p>
          <h1>Private website preview</h1>
          <p>This independent concept has been prepared for Mr Handsome. It is not the live business website.</p>
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
      <div className="preview-note">Private concept preview — not the live Mr Handsome website</div>

      <header>
        <button className="brand" onClick={() => go('top')}>MR HANDSOME</button>
        <nav className={menuOpen ? 'open' : ''}>
          <button onClick={() => go('work')}>Gallery</button>
          <button onClick={() => go('booking')}>Availability</button>
          <button onClick={() => go('reviews')}>Reviews</button>
          <button onClick={() => go('visit')}>Visit</button>
          <a href={business.facebook} target="_blank" rel="noreferrer">Facebook</a>
        </nav>
        <a className="header-cta" href="#booking">BOOK APPOINTMENT</a>
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
              <strong>{business.rating}</strong>
              <span>{business.reviews} Google reviews</span>
            </div>
            <div className="hero-actions">
              <a className="hero-primary" href="#booking"><CalendarDays size={16} /> Book appointment</a>
              <a className="hero-secondary" href={business.googleMaps} target="_blank" rel="noreferrer"><MapPin size={16} /> Directions</a>
            </div></div>
          </div>

          <figure className="hero-image">
            <img src={business.heroImage} alt="Hair styling at Mr Handsome barbershop" />
          </figure>
        </section>

        <section className="trust-strip" aria-label="Why visit Mr Handsome">
          <a className="trust-item trust-reviews" href={business.googleMaps} target="_blank" rel="noopener noreferrer" aria-label={`Find Mr Handsome on Google Maps. Rating ${business.rating} out of 5 from ${business.reviews} Google reviews`}>
            <span className="trust-icon trust-google" aria-hidden="true">G</span>
            <span className="trust-copy">
              <span className="trust-eyebrow">RATED ON GOOGLE</span>
              <span className="trust-primary"><strong>{business.rating}<small>/5</small></strong><span className="trust-stars" aria-label="Five stars">{[0,1,2,3,4].map(i => <Star key={i} size={15} fill="currentColor" />)}</span></span>
              <span className="trust-detail">{business.reviews} customer reviews <ChevronRight size={14} aria-hidden="true" /></span>
            </span>
          </a>
          <div className="trust-item">
            <span className="trust-icon" aria-hidden="true"><CalendarDays size={23} strokeWidth={1.6} /></span>
            <span className="trust-copy">
              <span className="trust-eyebrow">OPEN EVERY DAY</span>
              <span className="trust-primary"><strong>Mon–Sun</strong></span>
              <span className="trust-detail">See appointments · Book online</span>
            </span>
          </div>
          <a className="trust-item" href={business.googleMaps} target="_blank" rel="noopener noreferrer">
            <span className="trust-icon" aria-hidden="true"><MapPin size={23} strokeWidth={1.6} /></span>
            <span className="trust-copy">
              <span className="trust-eyebrow">FIND THE SHOP</span>
              <span className="trust-primary"><strong>25 The Green</strong></span>
              <span className="trust-detail">King’s Norton · Directions <ChevronRight size={14} aria-hidden="true" /></span>
            </span>
          </a>
        </section>

        <section className="work-showcase" id="work">
          <div className="work-head">
            <div>
              <p className="section-kicker">Recent work</p>
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

        <section className="services" id="services">
          <div className="services-shell">
            <div className="services-copy">
              <p className="section-kicker">Appointments</p>
              <h2>Book your next visit.</h2>
              <p>Choose a time, enter your name and you’re booked. No account required.</p>
            </div>
            <div className="booking-preview simple-booking" id="booking" aria-label="Upcoming appointment availability">
              <div className="booking-preview-head">
                <div><span className="booking-step">MR HANDSOME · KING'S NORTON</span><h3>Choose your appointment.</h3></div>
              </div>
              <div className="booking-phone-option"><span>Prefer to book by phone?</span><a href={business.phoneHref} aria-label={`Call Mr Handsome on ${business.phone}`}><Phone size={16}/> <span>{business.phone}</span></a></div>
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
                  <p className="simple-booking-label">Available times · 60-minute appointments</p>
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
                <label className="booking-agreement">
                  <input type="checkbox" checked={acceptedArrivalTerms} onChange={e=>setAcceptedArrivalTerms(e.target.checked)} required/>
                  <span>I understand that if I arrive late or miss my appointment, the barber may be unable to complete my service and may ask me to wait for the next available walk-in opportunity.</span>
                </label>
                {bookingError&&<p className="booking-form-error" role="alert">{bookingError}</p>}
                <button className="booking-submit" type="submit" disabled={!bookingTime||!acceptedArrivalTerms||customerName.trim().length<2||bookingSubmitting}>{bookingSubmitting?'Booking…':'Confirm appointment'}</button>
                <p className="booking-privacy">Your name and appointment are stored so the shop can manage your booking. To ask about your information or cancel, call <a href={business.phoneHref}>{business.phone}</a>. No email or SMS is sent.</p>
              </form>}

            </div>
          </div>
        </section>

        <section className="reviews" id="reviews">
          <div className="reviews-head">
            <div>
              <p className="section-kicker">Customer reviews</p>
              <h2>A reputation already earned.</h2>
            </div>
            <div className="review-score">
              <strong>{business.rating}</strong>
              <div>
                <div className="stars">{[0,1,2,3,4].map(i => <Star key={i} size={18} fill="currentColor" />)}</div>
                <span>{business.reviews} Google reviews</span>
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

        <section className="visit" id="visit">
          <div className="map-wrap">
            <iframe title="Mr Handsome location" src={business.googleEmbed} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
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
            </div>
          </div>
        </section>
      </main>

      <footer>
        <strong>MR HANDSOME</strong>
        <span>25 The Green · King’s Norton · Birmingham B38 8SD</span>
        <div className="footer-links"><a href={business.phoneHref}>Call {business.phone}</a><a href={business.googleMaps} target="_blank" rel="noreferrer">Directions</a><a href={business.facebook} target="_blank" rel="noreferrer">Facebook</a></div>
      </footer>

      <div className="mobile-actions" aria-label="Quick actions">
        <a href="#booking"><CalendarDays size={17} /> Book</a>
        <a href={business.googleMaps} target="_blank" rel="noreferrer"><MapPin size={17} /> Directions</a>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
