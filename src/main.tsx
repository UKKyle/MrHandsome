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
  googleMaps: "https://www.google.com/maps/search/?api=1&query=25+The+Green,+King's+Norton,+Birmingham+B38+8SD",
  googleEmbed: "https://www.google.com/maps?q=25+The+Green,+King's+Norton,+Birmingham+B38+8SD&output=embed",
  heroImage,
  hours: [
    ['Monday', '9:30am – 7:00pm'],
    ['Tuesday', '9:30am – 7:00pm'],
    ['Wednesday', '9:30am – 7:00pm'],
    ['Thursday', '9:30am – 7:00pm'],
    ['Friday', '9:30am – 7:00pm'],
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

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/slots', {signal:controller.signal,cache:'no-store'})
      .then(response => { if (!response.ok) throw new Error('Unavailable'); return response.json(); })
      .then((data:{slots:{date:string;time:string}[]}) => {
        const slots=Array.isArray(data.slots)?data.slots:[];
        setAvailableSlots(slots);
        setSelectedDate(slots[0]?.date ?? null);
        setSlotsLoaded(true);
      }).catch(() => { if (!controller.signal.aborted) setSlotsLoaded(true); });
    return () => controller.abort();
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
    }catch(e){setBookingError(e instanceof Error?e.message:'Unable to book. Please try again.');}
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
      <div className="preview-note">Private concept preview — not the live Mr Handsome website</div>

      <header>
        <button className="brand" onClick={() => go('top')}>MR HANDSOME</button>
        <nav className={menuOpen ? 'open' : ''}>
          <button onClick={() => go('services')}>Services</button>
          <button onClick={() => go('reviews')}>Reviews</button>
          <button onClick={() => go('visit')}>Visit</button>
          <a href={business.facebook} target="_blank" rel="noreferrer">Facebook</a>
        </nav>
        <a className="header-cta" href={business.phoneHref}>BOOK BY PHONE</a>
        <button className="menu-button" aria-label="Toggle navigation" onClick={() => setMenuOpen(v => !v)}>
          {menuOpen ? <X /> : <Menu />}
        </button>
      </header>

      <main>
        <section className="hero" id="top">
          <div className="hero-copy">
            <p className="hero-location">KING'S NORTON · BIRMINGHAM</p>
            <h1>MR<br/>HANDSOME</h1>
            <p className="hero-service-line">Haircuts · Fades · Beards · Shaves</p>
            <div className="rating-row">
              <div className="stars">{[0,1,2,3,4].map(i => <Star key={i} size={17} fill="currentColor" />)}</div>
              <strong>{business.rating}</strong>
              <span>{business.reviews} Google reviews</span>
            </div>
            <div className="hero-actions">
              <a className="hero-primary" href={business.phoneHref}><Phone size={16} /> Book by phone</a>
              <a className="hero-secondary" href={business.googleMaps} target="_blank" rel="noreferrer"><MapPin size={16} /> Directions</a>
            </div>
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
              <span className="trust-eyebrow">HERE WHEN YOU NEED US</span>
              <span className="trust-primary"><strong>7 days a week</strong></span>
              <span className="trust-detail">Open Monday to Sunday</span>
            </span>
          </div>
          <a className="trust-item" href={business.googleMaps} target="_blank" rel="noopener noreferrer">
            <span className="trust-icon" aria-hidden="true"><MapPin size={23} strokeWidth={1.6} /></span>
            <span className="trust-copy">
              <span className="trust-eyebrow">YOUR LOCAL BARBERS</span>
              <span className="trust-primary"><strong>King's Norton</strong></span>
              <span className="trust-detail">25 The Green · Get directions <ChevronRight size={14} aria-hidden="true" /></span>
            </span>
          </a>
        </section>

        <section className="services" id="services">
          <div className="services-shell">
            <div className="services-copy">
              <p className="section-kicker">Appointments</p>
              <h2>Your next visit, made simple.</h2>
              <p>Choose a day and time, enter your name, and book your appointment.</p>
            </div>
            <div className="booking-preview simple-booking" aria-label="Upcoming appointment availability">
              <div className="booking-preview-head">
                <div><span className="booking-step">MR HANDSOME · KING'S NORTON</span><h3>Find a time that suits you.</h3></div>
              </div>
              {!slotsLoaded ? <p className="simple-booking-empty">Checking upcoming availability…</p> :
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
              }
              {bookingConfirmation ? <div className="booking-success" role="status">
                <div className="booking-success-icon">✓</div>
                <h4>You're booked in.</h4>
                <p>{bookingConfirmation.name} · {new Date(bookingConfirmation.date+'T12:00:00').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})} at {bookingConfirmation.time}</p>
                <p>Please arrive on time. No email or text confirmation is sent, so keep a note of your appointment.</p>
                <button type="button" onClick={()=>setBookingConfirmation(null)}>Book another appointment</button>
              </div> : <form className="simple-booking-form" onSubmit={confirmBooking}>
                <label htmlFor="customer-booking-name">Your name</label>
                <input id="customer-booking-name" value={customerName} onChange={e=>setCustomerName(e.target.value)} placeholder="Full name" autoComplete="name" maxLength={80} minLength={2} required/>
                <label className="booking-agreement">
                  <input type="checkbox" checked={acceptedArrivalTerms} onChange={e=>setAcceptedArrivalTerms(e.target.checked)} required/>
                  <span>I understand that if I arrive late or miss my appointment, the barber may be unable to complete my service and may ask me to wait for the next available walk-in opportunity.</span>
                </label>
                {bookingError&&<p className="booking-form-error" role="alert">{bookingError}</p>}
                <button className="booking-submit" type="submit" disabled={!bookingTime||!acceptedArrivalTerms||customerName.trim().length<2||bookingSubmitting}>{bookingSubmitting?'Booking…':'Confirm appointment'}</button>
                <p className="booking-privacy">Only your name and appointment time are recorded. Please arrive on time.</p>
              </form>}

            </div>
          </div>
        </section>

        <section className="service-details" aria-label="Barber services"><div className="service-menu">
              {services.map(([title, description], index) => (
                <article className="service-line" key={title}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </div>
                </article>
              ))}
            </div>
        </section>

        <section className="work-showcase" id="work">
          <div className="work-head">
            <div>
              <p className="section-kicker">Recent work</p>
              <h2>Fresh from the chair.</h2>
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
            <span>{business.rating} from {business.reviews} Google reviews</span>
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
              <a className="visit-secondary" href={business.phoneHref}><Phone size={16} /> Book by phone</a>
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
        <span>25 The Green · King's Norton · Birmingham</span>
        <a href={business.facebook} target="_blank" rel="noreferrer">FACEBOOK</a>
      </footer>

      <div className="mobile-actions" aria-label="Quick actions">
        <a href={business.phoneHref}><Phone size={17} /> Book</a>
        <a href={business.googleMaps} target="_blank" rel="noreferrer"><MapPin size={17} /> Directions</a>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
