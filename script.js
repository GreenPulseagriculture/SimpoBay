
let supabaseClient = null;
let currentUser = null;
let allProducts = [];
let allServices = [];
let uploadedImages = [];
let imageFiles = [];
let currentProduct = null;
let marketplacePage = 1;
const PAGE_SIZE = 12;

// ==================== SUPABASE CLIENT ====================
async function initSupabase() {
    const SUPABASE_URL = 'https://qsfwplhaqysvyvthfsni.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_V7wOhmOeVSUZ9DkcDa1p9A_2z9Ne04E';
    
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    });
}

// ==================== MODAL FUNCTIONS ====================
function showLoginModal() {
    const modal = document.getElementById('login-modal');
    if (modal) modal.classList.remove('hidden').classList.add('flex');
}

function hideLoginModal() {
    const modal = document.getElementById('login-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

function showSignupModal() {
    const modal = document.getElementById('signup-modal');
    if (modal) modal.classList.remove('hidden').classList.add('flex');
}

function hideSignupModal() {
    const modal = document.getElementById('signup-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

function showPostListingModal() {
    const modal = document.getElementById('post-listing-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        resetPostForm();
    }
}

function hidePostListingModal() {
    const modal = document.getElementById('post-listing-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

// ==================== HELPERS ====================
function showButtonLoading(btnId, text) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = true;
    btn.dataset.original = btn.innerHTML;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${text}`;
}

function hideButtonLoading(btnId) {
    const btn = document.getElementById(btnId);
    if (!btn || !btn.dataset.original) return;
    btn.disabled = false;
    btn.innerHTML = btn.dataset.original;
    delete btn.dataset.original;
}

function showProductSkeletons(containerId, count) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
        const skeleton = document.createElement('div');
        skeleton.className = "bg-white rounded-3xl overflow-hidden shadow animate-pulse";
        skeleton.innerHTML = `
            <div class="w-full h-64 bg-gray-200"></div>
            <div class="p-6 space-y-3">
                <div class="h-6 bg-gray-200 rounded w-3/4"></div>
                <div class="h-8 bg-gray-200 rounded w-1/2"></div>
                <div class="h-4 bg-gray-200 rounded w-full"></div>
            </div>
        `;
        container.appendChild(skeleton);
    }
}

function getFirstImage(images) {
    if (!images) return 'https://picsum.photos/id/1015/400/300';
    if (Array.isArray(images) && images.length > 0) return images[0];
    if (typeof images === 'string') {
        try {
            const parsed = JSON.parse(images);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
            return images;
        } catch (e) { return images; }
    }
    return 'https://picsum.photos/id/1015/400/300';
}

// ==================== PROFILE DROPDOWN ====================
function toggleProfileDropdown() {
    const dropdown = document.getElementById('profile-dropdown');
    if (dropdown) dropdown.classList.toggle('hidden');
}

document.addEventListener('click', function(e) {
    const dropdown = document.getElementById('profile-dropdown');
    const profileBtn = document.getElementById('profile-btn');
    if (profileBtn && dropdown && 
        !profileBtn.contains(e.target) && 
        !dropdown.contains(e.target)) {
        dropdown.classList.add('hidden');
    }
});

// ==================== NAVIGATION ====================
function navigateTo(page) {
    document.querySelectorAll('section').forEach(sec => sec.style.display = 'none');

    if (page === 'home') {
        document.getElementById('home-section').style.display = 'block';
        renderTrending();
    } 
    else if (page === 'services') {
        document.getElementById('services-section').style.display = 'block';
        loadServices();
    } 
    else if (page === 'marketplace') {
        document.getElementById('marketplace-section').style.display = 'block';
        marketplacePage = 1;
        renderMarketplace();
    } 
    else if (page === 'sell') {
        showPostListingModal();
    } 
    else if (page === 'help') {
        openWhatsAppForRequest();
    }
}

function openWhatsAppForRequest() {
    const message = encodeURIComponent("Hello, I need urgent help with the marketplace.");
    window.open(`https://wa.me/265883944589?text=${message}`, '_blank');
}

// ==================== AUTO SERVICES HANDLER ====================
function handleCategoryChange() {
    const mainCategory = document.getElementById('listing-category')?.value;
    const listingTypeSelect = document.getElementById('listing-type');
    const subContainer = document.getElementById('sub-service-container');
    
    if (mainCategory === "Services") {
        if (listingTypeSelect) listingTypeSelect.value = "service";
        if (subContainer) subContainer.classList.remove('hidden');
    } else {
        if (listingTypeSelect) listingTypeSelect.value = "item";
        if (subContainer) subContainer.classList.add('hidden');
    }
}

// ==================== IMAGE UPLOAD ====================
async function uploadImagesToStorage() {
    const imageUrls = [];
    for (let file of imageFiles) {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `listings/${fileName}`;

            const { error } = await supabaseClient.storage
                .from('listings')
                .upload(filePath, file, { upsert: true });

            if (error) {
                console.error("Upload error:", error.message);
                continue;
            }

            const { data: { publicUrl } } = supabaseClient.storage
                .from('listings')
                .getPublicUrl(filePath);

            imageUrls.push(publicUrl);
        } catch (err) {
            console.error("Storage error:", err);
        }
    }
    return imageUrls;
}

// ==================== SUBMIT LISTING ====================
async function submitListing() {
    const btnId = 'submit-listing-btn';
    showButtonLoading(btnId, 'Submitting...');

    if (!currentUser) {
        hideButtonLoading(btnId);
        return alert("Please login first");
    }

    if (imageFiles.length === 0) {
        hideButtonLoading(btnId);
        return alert("❌ Please upload at least one image for your listing.");
    }

    const listingType = document.getElementById('listing-type')?.value || 'item';
    const mainCategory = document.getElementById('listing-category')?.value || 'General';
    const subService = document.getElementById('sub-service')?.value || '';

    let finalTitle = (document.getElementById('listing-title')?.value || '').trim();
    if (subService) finalTitle = subService + " - " + finalTitle;

    const price = parseFloat(document.getElementById('listing-price')?.value);

    if (!finalTitle || isNaN(price) || price <= 0) {
        hideButtonLoading(btnId);
        return alert("Title and valid price are required");
    }

    const imageUrls = await uploadImagesToStorage();

    const payload = {
        title: finalTitle,
        price: price,
        category: mainCategory,
        sub_category: subService,
        type: listingType,
        description: document.getElementById('listing-desc')?.value?.trim() || '',
        seller_id: currentUser.id,
        seller_name: document.getElementById('seller-name')?.value?.trim() || currentUser.name,
        seller_location: document.getElementById('seller-location')?.value?.trim() || "Malawi",
        seller_phone: document.getElementById('seller-phone')?.value?.trim() || '',
        seller_whatsapp: document.getElementById('seller-whatsapp')?.value?.trim() || '',
        status: 'pending',
        images: imageUrls
    };

    const { error } = await supabaseClient.from('listings').insert(payload);

    hideButtonLoading(btnId);

    if (error) {
        alert("Error: " + error.message);
    } else {
        alert(`✅ ${listingType === 'service' ? 'Service' : 'Product'} submitted successfully!`);
        hidePostListingModal();
        resetPostForm();
        loadProducts();
        if (listingType === 'service') loadServices();
        if (currentUser.role === 'seller') loadMyListings();
    }
}

// ==================== AUTH FUNCTIONS ====================
async function performSignup() {
    const btnId = 'signup-submit-btn';
    showButtonLoading(btnId, 'Creating account...');

    const fullName = document.getElementById('signup-name')?.value.trim();
    const phone = document.getElementById('signup-phone')?.value.trim();
    const password = document.getElementById('signup-password')?.value.trim();

    if (!fullName || !phone || !password) {
        hideButtonLoading(btnId);
        return alert("All fields are required");
    }

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const fakeEmail = `user.${cleanPhone}@malawimarket.local`;

    const { error } = await supabaseClient.auth.signUp({
        email: fakeEmail,
        password: password,
        options: { data: { full_name: fullName, phone: phone, role: 'seller' } }
    });

    hideButtonLoading(btnId);
    if (error) alert("Signup error: " + error.message);
    else {
        alert(`✅ Account created!\nYou can now login with phone: ${phone}`);
        hideSignupModal();
        showLoginModal();
    }
}

async function performLogin() {
    const btnId = 'login-submit-btn';
    showButtonLoading(btnId, 'Logging in...');

    const username = document.getElementById('login-username')?.value.trim();
    const password = document.getElementById('login-password')?.value.trim();

    if (username === '0883944589' && password === 'Waiyatsa1651') {
        currentUser = { role: 'admin', name: "Macmillan Waiyatsa", id: 'admin' };
        hideButtonLoading(btnId);
        finishLogin();
        return;
    }

    if (!username || !password) {
        hideButtonLoading(btnId);
        return alert("Phone number and password are required");
    }

    const cleanPhone = username.replace(/[^0-9]/g, '');
    const fakeEmail = `user.${cleanPhone}@malawimarket.local`;

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: fakeEmail,
        password: password
    });

    hideButtonLoading(btnId);
    if (error) {
        return alert("Login failed: " + error.message);
    }

    currentUser = {
        role: 'seller',
        name: data.user?.user_metadata?.full_name || username,
        id: data.user.id
    };

    finishLogin();
}

function finishLogin() {
    document.getElementById('dropdown-user-info').classList.remove('hidden');
    document.getElementById('dropdown-username').textContent = currentUser.name;
    document.getElementById('dropdown-role').textContent = currentUser.role === 'admin' ? 'Administrator' : 'Seller';

    document.getElementById('logged-in-options').classList.remove('hidden');
    document.getElementById('logged-out-options').classList.add('hidden');

    if (currentUser.role === 'admin') {
        document.getElementById('admin-link').classList.remove('hidden');
    }

    hideLoginModal();

    if (currentUser.role === 'admin') {
        showAdminDashboard();
    } else {
        showSellerDashboard();
    }
}

async function checkAuthState() {
    if (!supabaseClient) return;
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session?.user) {
        currentUser = {
            role: 'seller',
            name: session.user.user_metadata?.full_name || "Seller",
            id: session.user.id
        };
        finishLogin();
    }
}

async function logout() {
    if (confirm("Are you sure you want to log out?")) {
        await supabaseClient.auth.signOut();
        currentUser = null;
        location.reload();
    }
}

// ==================== SELLER DASHBOARD ====================
function showSellerDashboard() {
    document.querySelectorAll('section').forEach(s => s.style.display = 'none');
    document.getElementById('seller-dashboard').style.display = 'block';
    document.getElementById('seller-name').textContent = currentUser?.name || '';
    loadMyListings();
}

async function loadMyListings() {
    if (!currentUser) return;
    const { data } = await supabaseClient
        .from('listings')
        .select('*')
        .eq('seller_id', currentUser.id)
        .order('created_at', { ascending: false });

    const total = data ? data.length : 0;
    const pendingCount = data ? data.filter(l => l.status === 'pending').length : 0;
    const approvedCount = data ? data.filter(l => l.status === 'approved').length : 0;
    const soldCount = data ? data.filter(l => l.status === 'sold').length : 0;

    document.getElementById('seller-total').textContent = total;
    document.getElementById('seller-pending').textContent = pendingCount;
    document.getElementById('seller-approved').textContent = approvedCount;
    document.getElementById('seller-sold').textContent = soldCount;

    const container = document.getElementById('my-listings-container');
    container.innerHTML = '';

    if (!data || data.length === 0) {
        container.innerHTML = `<p class="text-center text-gray-500 py-12">You have not posted any listings yet.</p>`;
        return;
    }

    data.forEach(listing => {
        let actionHTML = '';
        if (listing.status !== 'sold') {
            actionHTML = `<button onclick="markAsSold('${listing.id}')" class="px-6 py-2 bg-green-600 text-white rounded-2xl text-sm font-medium hover:bg-green-700">Mark as Sold</button>`;
        } else {
            actionHTML = `<span class="text-gray-500 font-medium">Sold</span>`;
        }

        const div = document.createElement('div');
        div.className = "border rounded-3xl p-6 bg-white flex justify-between items-center";
        div.innerHTML = `
            <div>
                <h4 class="font-semibold text-lg">${listing.title}</h4>
                <p class="text-green-700 font-bold">K ${Number(listing.price).toLocaleString()}</p>
                <p class="text-sm text-gray-600">${listing.seller_name || ''} • ${listing.seller_location || ''}</p>
                <p class="text-sm ${listing.status === 'approved' ? 'text-green-600' : listing.status === 'sold' ? 'text-gray-500 line-through' : 'text-yellow-600'}">
                    ${listing.status}
                </p>
            </div>
            <div class="flex items-center gap-3">${actionHTML}</div>
        `;
        container.appendChild(div);
    });
}

// ==================== ADMIN DASHBOARD ====================
function showAdminDashboard() {
    document.querySelectorAll('section').forEach(s => s.style.display = 'none');
    document.getElementById('admin-dashboard').style.display = 'block';
    loadPendingListings();
    loadLiveListingsForAdmin();
    loadAdminStats();
}

async function loadAdminStats() {
    const { data } = await supabaseClient.from('listings').select('status');
    if (!data) return;
    const pending = data.filter(l => l.status === 'pending').length;
    const live = data.filter(l => l.status === 'approved').length;
    const total = data.length;
    const rejected = data.filter(l => l.status === 'rejected').length;

    document.getElementById('admin-pending-count').textContent = pending;
    document.getElementById('admin-live-count').textContent = live;
    document.getElementById('admin-total-count').textContent = total;
    document.getElementById('admin-rejected-count').textContent = rejected;
}

async function loadPendingListings() {
    const { data } = await supabaseClient.from('listings').select('*').eq('status', 'pending');
    const tbody = document.getElementById('admin-tbody');
    tbody.innerHTML = '';

    if (!data || data.length === 0) {
        document.getElementById('admin-empty-state').classList.remove('hidden');
        return;
    }
    document.getElementById('admin-empty-state').classList.add('hidden');

    data.forEach(listing => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="py-4">${listing.title}</td>
            <td class="py-4">${listing.seller_name || listing.seller_phone || 'N/A'}</td>
            <td class="py-4">K ${Number(listing.price).toLocaleString()}</td>
            <td class="py-4 text-center">
                <button onclick="approveListing('${listing.id}')" class="bg-green-600 text-white px-4 py-1 rounded-xl text-sm mr-2">Approve</button>
                <button onclick="rejectListing('${listing.id}')" class="bg-red-600 text-white px-4 py-1 rounded-xl text-sm">Reject</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function loadLiveListingsForAdmin() {
    const { data } = await supabaseClient
        .from('listings')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

    const container = document.getElementById('admin-live-products');
    container.innerHTML = '';

    if (!data || data.length === 0) {
        document.getElementById('admin-live-empty').classList.remove('hidden');
        return;
    }
    document.getElementById('admin-live-empty').classList.add('hidden');

    data.forEach(listing => {
        const imageUrl = getFirstImage(listing.images);
        const typeLabel = listing.type === 'service' ? 'Service' : 'Item';

        const div = document.createElement('div');
        div.className = "bg-white border rounded-3xl p-6 shadow";
        div.innerHTML = `
            <img src="${imageUrl}" onerror="this.src='https://picsum.photos/id/1015/400/300'" 
                 class="w-full h-48 object-cover rounded-2xl mb-4">
            <h4 class="font-semibold text-lg">${listing.title}</h4>
            <p class="text-green-700 font-bold text-xl">K ${Number(listing.price).toLocaleString()}</p>
            <p class="text-sm text-gray-500 mt-1">${typeLabel} • ${listing.seller_location || 'Malawi'}</p>
        `;
        container.appendChild(div);
    });
}

async function approveListing(id) {
    await supabaseClient.from('listings').update({ status: 'approved' }).eq('id', id);
    alert("✅ Approved!");
    loadPendingListings();
    loadLiveListingsForAdmin();
    loadAdminStats();
    loadProducts();
    loadServices();
}

async function rejectListing(id) {
    if (!confirm("Reject this listing?")) return;
    await supabaseClient.from('listings').update({ status: 'rejected' }).eq('id', id);
    alert("Rejected");
    loadPendingListings();
    loadAdminStats();
}

async function markAsSold(id) {
    if (confirm("Mark this listing as sold?")) {
        await supabaseClient.from('listings').update({ status: 'sold' }).eq('id', id);
        alert("✅ Marked as sold!");
        loadMyListings();
        loadProducts();
        loadServices();
    }
}

// ==================== SERVICES ====================
async function loadServices() {
    const container = document.getElementById('services-grid');
    if (!container) return;
    container.innerHTML = '<p class="col-span-full text-center py-12 text-gray-500">Loading services...</p>';

    const { data, error } = await supabaseClient
        .from('listings')
        .select('*')
        .eq('type', 'service')
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

    if (error) {
        console.error(error);
        container.innerHTML = `<p class="col-span-full text-center py-12 text-red-500">Error loading services.</p>`;
        return;
    }

    allServices = data || [];
    renderServices(allServices);
}

async function filterServices() {
    const categoryFilter = document.getElementById('service-category-filter').value;
    const locationFilter = document.getElementById('service-location-filter').value.trim().toLowerCase();

    let query = supabaseClient
        .from('listings')
        .select('*')
        .eq('type', 'service')
        .eq('status', 'approved');

    if (categoryFilter && categoryFilter !== 'all') {
        query = query.eq('category', categoryFilter);
    }
    if (locationFilter) {
        query = query.ilike('seller_location', `%${locationFilter}%`);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
        console.error("Filter error:", error);
        return;
    }

    allServices = data || [];
    renderServices(allServices);
}

function renderServices(services) {
    const container = document.getElementById('services-grid');
    if (!container) return;
    container.innerHTML = '';

    if (services.length === 0) {
        container.innerHTML = `<p class="col-span-full text-center py-12 text-gray-500">No services found matching your filter.</p>`;
        return;
    }

    services.forEach(item => {
        const imageUrl = getFirstImage(item.images);
        const card = document.createElement('div');
        card.className = "bg-white rounded-3xl overflow-hidden shadow hover:shadow-xl cursor-pointer transition-all";

        card.innerHTML = `
            <img src="${imageUrl}" onerror="this.src='https://picsum.photos/id/1015/400/300'" 
                 class="w-full h-56 object-cover bg-gray-200">
            <div class="p-6">
                <h4 class="font-semibold text-lg">${item.title}</h4>
                <p class="text-emerald-600 font-bold text-2xl mt-2">K ${Number(item.price).toLocaleString()}</p>
                <p class="text-sm text-gray-500 mt-1">📍 ${item.seller_location || 'Malawi'}</p>
                <p class="text-gray-600 mt-4 line-clamp-3">${item.description || ''}</p>
                <div class="mt-6 flex gap-3">
                    <button onclick="event.stopImmediatePropagation(); contactSeller('${item.id}', 'phone')" 
                            class="flex-1 py-3 bg-gray-100 hover:bg-gray-200 rounded-2xl text-sm">📞 Call</button>
                    <button onclick="event.stopImmediatePropagation(); contactSeller('${item.id}', 'whatsapp')" 
                            class="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-2xl text-sm">
                        <i class="fa-brands fa-whatsapp"></i> WhatsApp
                    </button>
                </div>
            </div>
        `;

        card.addEventListener('click', () => showProductDetail(item.id));
        container.appendChild(card);
    });
}

// ==================== PRODUCT RENDERING ====================
function renderProducts(containerId, list) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    if (!list || list.length === 0) {
        container.innerHTML = `<p class="col-span-full text-center py-12 text-gray-500">No items found.</p>`;
        return;
    }

    list.forEach(product => {
        const imageUrl = getFirstImage(product.images);
        const rating = (4 + Math.random() * 1).toFixed(1);

        const card = document.createElement('div');
        card.className = "product-card bg-white rounded-3xl overflow-hidden cursor-pointer shadow hover:shadow-xl transition-all";

        card.innerHTML = `
            <img src="${imageUrl}" onerror="this.src='https://picsum.photos/id/1015/400/300'" 
                 class="w-full h-64 object-cover bg-gray-200">
            <div class="p-6">
                <h4 class="font-semibold text-lg mb-2">${product.title}</h4>
                <div class="flex justify-between items-center mb-3">
                    <span class="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs rounded-3xl">${product.category || 'General'}</span>
                    <div class="flex items-center gap-1 text-amber-500 text-sm">
                        ★ <span>${rating}</span>
                    </div>
                </div>
                <p class="text-green-700 font-bold text-2xl">K ${Number(product.price).toLocaleString()}</p>
                <p class="text-sm text-gray-600 mt-2">📍 ${product.seller_location || 'Malawi'}</p>
                <div class="mt-6 flex gap-3" onclick="event.stopImmediatePropagation()">
                    <button onclick="event.stopImmediatePropagation(); contactSeller('${product.id}', 'phone')" 
                            class="flex-1 py-3 bg-gray-100 hover:bg-gray-200 rounded-2xl text-sm">📞 Call</button>
                    <button onclick="event.stopImmediatePropagation(); contactSeller('${product.id}', 'whatsapp')" 
                            class="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-2xl text-sm">
                        <i class="fa-brands fa-whatsapp"></i> WhatsApp
                    </button>
                </div>
            </div>
        `;

        card.addEventListener('click', (e) => {
            if (!e.target.closest('button')) showProductDetail(product.id);
        });

        container.appendChild(card);
    });
}

function renderFeatured() {
    renderProducts('home-featured-grid', allProducts.slice(0, 8));
}

function renderTrending() {
    renderProducts('trending-grid', allProducts.slice(0, 8));
}

function renderMarketplace() {
    const end = marketplacePage * PAGE_SIZE;
    renderProducts('marketplace-grid', allProducts.slice(0, end));
    const loadBtn = document.getElementById('load-more-btn');
    if (loadBtn) loadBtn.style.display = (end < allProducts.length) ? 'block' : 'none';
}

// ==================== PRODUCT DETAIL ====================
function showProductDetail(id) {
    currentProduct = allProducts.find(p => String(p.id) === String(id)) || 
                     allServices.find(s => String(s.id) === String(id));

    if (!currentProduct) return alert("Item not found.");

    document.getElementById('detail-title').textContent = currentProduct.title;
    document.getElementById('detail-price').textContent = `K ${Number(currentProduct.price).toLocaleString()}`;
    document.getElementById('detail-desc').textContent = currentProduct.description || "No description provided.";

    const imagesContainer = document.getElementById('detail-images');
    imagesContainer.innerHTML = '';

    let images = currentProduct.images || [];
    if (typeof images === 'string') {
        try { images = JSON.parse(images); } 
        catch (e) { images = images ? [images] : []; }
    }

    if (!Array.isArray(images) || images.length === 0) {
        images = ["https://picsum.photos/id/1015/800/600"];
    }

    images.forEach(src => {
        if (!src) return;
        const img = document.createElement('img');
        img.src = src;
        img.className = "w-full rounded-2xl cursor-pointer object-cover mb-4 bg-gray-100";
        img.onerror = () => { img.src = 'https://picsum.photos/id/1015/800/600'; };
        img.onclick = () => zoomImage(src);
        imagesContainer.appendChild(img);
    });

    const phone = currentProduct.seller_phone || '';
    let wa = (currentProduct.seller_whatsapp || phone).replace(/[^0-9]/g, '');
    if (wa.length === 9) wa = '265' + wa;
    else if (wa.length === 10 && wa.startsWith('0')) wa = '265' + wa.substring(1);

    document.getElementById('detail-call-btn').onclick = () => phone ? window.location.href = `tel:${phone}` : alert("No phone available");
    document.getElementById('detail-whatsapp-btn').onclick = () => wa ? window.open(`https://wa.me/${wa}`, '_blank') : alert("No WhatsApp available");

    document.getElementById('product-detail-modal').classList.remove('hidden').classList.add('flex');
}

function closeProductDetail() {
    const modal = document.getElementById('product-detail-modal');
    if (modal) modal.classList.add('hidden').classList.remove('flex');
}

function zoomImage(src) {
    document.getElementById('zoomed-image').src = src;
    document.getElementById('image-zoom-modal').classList.remove('hidden').classList.add('flex');
}

function closeImageZoom() {
    const modal = document.getElementById('image-zoom-modal');
    if (modal) modal.classList.add('hidden').classList.remove('flex');
}

function contactSeller(id, type) {
    const product = allProducts.find(p => String(p.id) === String(id)) || 
                    allServices.find(s => String(s.id) === String(id));
    if (!product) return;

    const phone = product.seller_phone || '';
    let wa = (product.seller_whatsapp || phone).replace(/[^0-9]/g, '');
    if (wa.length === 9) wa = '265' + wa;
    else if (wa.length === 10 && wa.startsWith('0')) wa = '265' + wa.substring(1);

    if (type === 'phone' && phone) window.location.href = `tel:${phone}`;
    if (type === 'whatsapp' && wa) window.open(`https://wa.me/${wa}`, '_blank');
}

// ==================== IMAGE HANDLING ====================
function handleImageUpload(e) {
    const files = Array.from(e.target.files);
    if (uploadedImages.length + files.length > 6) return alert("Maximum 6 images allowed!");

    files.forEach(file => {
        if (!file.type.startsWith('image/')) return;
        imageFiles.push(file);
        const reader = new FileReader();
        reader.onload = ev => {
            uploadedImages.push(ev.target.result);
            renderPreviews();
        };
        reader.readAsDataURL(file);
    });
    e.target.value = '';
}

function renderPreviews() {
    const container = document.getElementById('preview-container');
    if (!container) return;
    container.innerHTML = '';
    uploadedImages.forEach((src, i) => {
        const div = document.createElement('div');
        div.className = "aspect-square rounded-2xl overflow-hidden border relative";
        div.innerHTML = `
            <img src="${src}" class="w-full h-full object-cover">
            <button onclick="removePreviewImage(${i}); event.stopImmediatePropagation()" 
                    class="absolute top-1 right-1 bg-red-600 text-white w-6 h-6 rounded-full text-xs">×</button>
        `;
        container.appendChild(div);
    });
}

function removePreviewImage(index) {
    uploadedImages.splice(index, 1);
    imageFiles.splice(index, 1);
    renderPreviews();
}

// ==================== SEARCH & FILTERS ====================
function performSearch() {
    const query = (document.getElementById('search-input')?.value || '').toLowerCase().trim();
    const category = document.getElementById('category-filter')?.value || '';
    const location = document.getElementById('marketplace-location-filter')?.value.trim() || '';

    const filtered = allProducts.filter(p => {
        const matchQuery = !query || p.title.toLowerCase().includes(query);
        const matchCat = !category || (p.category || '').toLowerCase() === category.toLowerCase();
        const matchLocation = !location || (p.seller_location || '').toLowerCase().includes(location.toLowerCase());
        return matchQuery && matchCat && matchLocation;
    });

    renderProducts('marketplace-grid', filtered);
}

// ==================== LOAD PRODUCTS ====================
async function loadProducts() {
    showProductSkeletons('home-featured-grid', 8);

    try {
        const { data, error } = await supabaseClient
            .from('listings')
            .select('*')
            .eq('status', 'approved')
            .not('type', 'eq', 'service')
            .order('created_at', { ascending: false })
            .limit(60);

        if (error) throw error;

        allProducts = (data || []).map(item => ({
            ...item,
            rating: (4 + Math.random() * 1).toFixed(1)
        }));

    } catch (e) {
        console.error("Error loading products:", e);
    }

    renderFeatured();
    renderMarketplace();
    renderTrending();
}

// ==================== RESET POST FORM ====================
function resetPostForm() {
    uploadedImages = [];
    imageFiles = [];
    renderPreviews();
    const btn = document.getElementById('submit-listing-btn');
    if (btn) {
        btn.textContent = 'Submit Listing';
        btn.setAttribute('onclick', 'submitListing()');
    }
}

// ==================== START APPLICATION ====================
window.onload = async () => {
    await initSupabase();
    await checkAuthState();
    await loadProducts();
    await loadServices();

    // Service Filters
    const serviceCatFilter = document.getElementById('service-category-filter');
    const serviceLocFilter = document.getElementById('service-location-filter');
    if (serviceCatFilter) serviceCatFilter.addEventListener('change', filterServices);
    if (serviceLocFilter) serviceLocFilter.addEventListener('input', filterServices);

    // Auto Services Handler
    const categorySelect = document.getElementById('listing-category');
    if (categorySelect) {
        categorySelect.addEventListener('change', handleCategoryChange);
    }

    navigateTo('home');
    console.log("✅ SimpoBay loaded successfully!");
};