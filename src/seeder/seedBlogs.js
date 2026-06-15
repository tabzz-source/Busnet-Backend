const mongoose = require('mongoose');
const dotenv = require('dotenv');
const BlogPost = require('../models/BlogPost');
const Account = require('../models/Account');

dotenv.config();

const MOCK_POSTS = [
  {
    title: 'Discovering the Trans-Vietnam Journey by Premium Coach 2024',
    slug: 'discovering-the-trans-vietnam-journey-by-premium-coach-2024',
    summary: 'Learn about the most scenic routes and how to optimize your long-distance travel experience with the BusNet smart booking system.',
    content: `<p>The Trans-Vietnam journey has always been a dream for those who love travel and discovery. In 2024, experiencing this route by premium sleeper coach has become easier and more comfortable than ever, thanks to major improvements in modern sleeper limousine buses.</p>

<h2>Featured Trans-Vietnam Routes</h2>
<p>Here are some of the most notable scenic routes for your trans-national exploration:</p>
<ul>
  <li><strong>Central Heritage Route:</strong> From Da Nang through the ancient town of Hoi An, Lang Co Hue, and Phong Nha Ke Bang National Park. This route brings together all the natural beauty and rich cultural history of Vietnam.</li>
  <li><strong>Pristine Coastal Route:</strong> Passing through Phan Thiet, Nha Trang, and Quy Nhon. The blue waves, white sands, and poetic coconut trees along Highway 1A will surely catch your eyes.</li>
</ul>

<h2>Benefits of Premium Sleeper Coaches</h2>
<p>Traveling by high-end sleeper coaches (limousines) offers outstanding advantages:</p>
<ul>
  <li>Independent sleeping cabins, private curtains, USB charging ports, reading lights, and integrated massage systems.</li>
  <li>Visual BusNet booking system helps you select the exact preferred berth, pay quickly, and check real-time routes.</li>
  <li>Professional, highly experienced drivers ensuring absolute safety throughout the thousands-of-kilometers journey.</li>
</ul>`,
    tag: 'Featured News',
    coverImage: '/images/blog_hero.png',
    status: 'PUBLISHED',
    views: 124,
    publishedAt: new Date('2024-05-12T10:00:00.000Z')
  },
  {
    title: '10 Must-Visit Locations When Exploring Hanoi',
    slug: '10-must-visit-locations-when-exploring-hanoi',
    summary: 'From ancient historical streets to unique railway coffee shops, Hanoi always knows how to charm travelers...',
    content: `<p>Hanoi - the thousand-year-old capital always carries a solemn, ancient beauty blended with bustling modern life. If you are planning to visit Hanoi by high-quality coach from neighboring provinces, here are the top locations you must visit:</p>

<h2>Lakes and Historical Streets</h2>
<p>Explore the historic core of Hanoi:</p>
<ul>
  <li><strong>Hoan Kiem Lake &amp; Ngoc Son Temple:</strong> The heart of the capital with the ancient Turtle Tower standing out in the middle of clear blue water.</li>
  <li><strong>Hanoi Old Quarter:</strong> 36 streets preserving ancient architecture and rich street food culture.</li>
</ul>

<h2>Sacred Monuments and Unique Culture</h2>
<p>Experience local heritage and modern attractions:</p>
<ul>
  <li><strong>Uncle Ho's Mausoleum &amp; Ba Dinh Square:</strong> A sacred place preserving the body of President Ho Chi Minh.</li>
  <li><strong>Phung Hung Train Street Cafe:</strong> The unique experience of sipping coffee right next to the train tracks passing through the heart of the city.</li>
  <li><strong>West Lake &amp; Tran Quoc Pagoda:</strong> The oldest pagoda in Hanoi, sitting peacefully on a small peninsula east of West Lake.</li>
</ul>`,
    tag: 'Destinations',
    coverImage: '/images/blog_hanoi.png',
    status: 'PUBLISHED',
    views: 89,
    publishedAt: new Date('2024-05-10T09:30:00.000Z')
  },
  {
    title: 'Tips for Staying Healthy on Long-Distance Coach Rides',
    slug: 'tips-for-staying-healthy-on-long-distance-coach-rides',
    summary: 'How to avoid motion sickness and fatigue? These simple tips will make your journey smoother than ever.',
    content: `<p>Traveling long distances of hundreds of kilometers by coach can sometimes cause fatigue or motion sickness if you are not well-prepared. Here are the golden tips shared by veteran drivers to keep you fully energized:</p>

<h2>Berth Selection and Pre-departure Preparation</h2>
<ul>
  <li><strong>Select the right berth position:</strong> Opt for berths in the middle rows or lower deck, avoiding the back seats to minimize vibration when the coach goes over bumpy roads.</li>
  <li><strong>Have a light meal before departure:</strong> Do not travel on an empty or overly full stomach. Avoid greasy food, carbonated drinks, or milk 2 hours before boarding.</li>
</ul>

<h2>Onboard Comfort and Sleep Tips</h2>
<ul>
  <li><strong>Prepare travel accessories:</strong> A U-shaped neck pillow, light-blocking eye mask, noise-canceling headphones, and a few ginger candies will be wonderful travel companions.</li>
  <li><strong>Breathe deeply and relax:</strong> Make use of the private cabin curtains on VIP sleeper buses to rest, listen to soft music, and get enough sleep throughout the trip.</li>
</ul>`,
    tag: 'Travel Guides',
    coverImage: '/images/blog_coach.png',
    status: 'PUBLISHED',
    views: 45,
    publishedAt: new Date('2024-05-08T08:00:00.000Z')
  },
  {
    title: 'Transportation and the Future of Smart Coaches',
    slug: 'transportation-and-the-future-of-smart-coaches',
    summary: 'The rapid development of booking applications and digital transformation in passenger transport in Vietnam.',
    content: `<p>The passenger transport industry is witnessing a strong tech revolution. The rise of smart platforms like BusNet not only helps passengers save time but also elevates management standards for coach operators.</p>

<h2>Core Tech Trends</h2>
<ul>
  <li>24/7 smart booking that visualizes actual cabin layouts.</li>
  <li>Online GPS tracking systems to help passengers manage boarding times and family members monitor the journey.</li>
</ul>

<h2>Digital Check-in &amp; Eco-friendly Vehicles</h2>
<ul>
  <li><strong>Electronic tickets (E-tickets) via QR codes:</strong> Simpler check-in procedures, environment friendly, and faster dispatching.</li>
  <li><strong>Electric coaches:</strong> Environmentally friendly electric coaches being gradually tested on fixed routes.</li>
</ul>`,
    tag: 'News',
    coverImage: '/images/blog_sunset.png',
    status: 'PUBLISHED',
    views: 110,
    publishedAt: new Date('2024-05-05T07:15:00.000Z')
  },
  {
    title: 'Guide to Using the BusNet App to Book Tickets in 60 Seconds',
    slug: 'guide-to-using-the-busnet-app-to-book-tickets-in-60-seconds',
    summary: 'How to search routes, select ideal seats, and secure online payments in just a few simple taps.',
    content: `<p>BusNet is proud to bring you the most convenient coach booking experience. Simply follow these 4 steps to secure tickets for your next trip:</p>

<h2>Searching and Filtering Trips</h2>
<ul>
  <li><strong>Step 1:</strong> Choose your Origin, Destination, and Departure Date on the homepage search tool.</li>
  <li><strong>Step 2:</strong> Use smart filters to sort trips by Departure Time, Price, Preferred Operators, or Vehicle Type (Limousine, Sleeper, VIP Cabin).</li>
</ul>

<h2>Seat Selection and Payment</h2>
<ul>
  <li><strong>Step 3:</strong> Select your preferred berth on the visual layout. Available and booked seats are clearly color-coded.</li>
  <li><strong>Step 4:</strong> Enter passenger details accurately and pay via E-wallets (Momo, ZaloPay), local cards, or QR transfer. A QR code E-ticket will be sent immediately to your phone.</li>
</ul>`,
    tag: 'Features',
    coverImage: '/images/blog_phone.png',
    status: 'PUBLISHED',
    views: 231,
    publishedAt: new Date('2024-05-02T15:45:00.000Z')
  },
  {
    title: 'Top 5 Must-Try Dishes in the City of Flowers, Da Lat',
    slug: 'top-5-must-try-dishes-in-the-city-of-flowers-da-lat',
    summary: 'Discover the culinary paradise of Da Lat at night with signature dishes of this dreamy foggy land...',
    content: `<p>Da Lat charms visitors not only with its year-round cool climate but also with its rich and unique culinary paradise. When traveling to Da Lat by coach, save this list of 5 famous dishes to enjoy with friends:</p>

<h2>Savory Main Dishes</h2>
<ul>
  <li><strong>Grilled rice paper (Da Lat Pizza):</strong> Crispy thin rice paper grilled over charcoal with chicken eggs, green onions, cheese, sausage, and dried beef.</li>
  <li><strong>Chicken hotpot with lemon basil leaves (Lá É):</strong> The sweet taste of free-range chicken blended with the spicy, aromatic taste of lemon basil leaves and hot sour bamboo shoots.</li>
  <li><strong>Bread with meatballs (Xíu Mại):</strong> A bowl of steaming hot meatball broth served with crispy bread in the misty morning.</li>
</ul>

<h2>Famous Desserts &amp; Drinks</h2>
<ul>
  <li><strong>Da Lat Avocado Ice Cream:</strong> Rich and creamy avocado puree served with a scoop of sweet vanilla ice cream and toasted coconut shreds.</li>
  <li><strong>Hot soy milk &amp; pastries:</strong> A simple night market culinary culture that warms the heart.</li>
</ul>`,
    tag: 'Travel Guides',
    coverImage: '/images/blog_food.png',
    status: 'PUBLISHED',
    views: 312,
    publishedAt: new Date('2024-05-10T11:00:00.000Z')
  }
];

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB successfully.');

    // 1. Find or create a Partner Account to act as author
    let partner = await Account.findOne({ role: 'PARTNER' });
    if (!partner) {
      console.log('ℹ No Partner Account found. Creating a default partner account...');
      partner = await Account.create({
        username: 'phuongtrang_partner',
        email: 'partner@phuongtrang.com',
        fullName: 'Phuong Trang Coach',
        role: 'PARTNER',
        status: 'ACTIVE',
        isEmailVerified: true
      });
      console.log('✅ Created default Partner Account:', partner._id);
    } else {
      console.log('✅ Found existing Partner Account:', partner.fullName, `(${partner._id})`);
    }

    // 2. Insert mock blogs (Clear existing first to force reload of HTML content)
    console.log('ℹ Cleaning old blog posts in blog_post...');
    await BlogPost.deleteMany({});
    console.log('✅ Cleaned old blog posts.');

    let insertedCount = 0;
    for (const post of MOCK_POSTS) {
      await BlogPost.create({
        ...post,
        authorId: partner._id
      });
      insertedCount++;
      console.log(`+ Seeded blog post with HTML: "${post.title}"`);
    }

    console.log(`\n🎉 Seeding complete! Added ${insertedCount} new blog posts with HTML format.`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  }
};

seed();
