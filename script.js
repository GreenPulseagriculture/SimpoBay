// ==================== GLOBAL VARIABLES ====================
let supabaseClient = null;
let currentUser = null;
let allProducts = [];
let allServices = [];
let currentFilteredServices = [];
let currentFilteredProducts = [];

let uploadedImages = [];
let imageFiles = [];
let existingImages = [];
let currentEditingId = null;
let currentProduct = null;

let marketplacePage = 1;
let servicesPage = 1;
const PAGE_SIZE = 12;

let touchStartX = 0;
let touchEndX = 0;

// ==================== TOAST NOTIFICATION ====================
function showToast(message, type = 'success') {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'fixed bottom-6 right-6 z-50 flex flex-col gap-2';
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    let bgColor = 'bg-gray-700';
    if (type === 'success') bgColor = 'bg-green-600';
    else if (type === 'error') bgColor = 'bg-red-600';
    else if (type === 'warning') bgColor = 'bg-yellow-600';

    toast.className = `px-6 py-4 rounded-2xl shadow-xl text-white flex items-center gap-3 max-w-sm transition-all duration-300 ${bgColor}`;

    toast.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()" class="ml-auto text-white/80 hover:text-white text-xl leading-none">×</button>
    `;

    toastContainer.appendChild(toast);
    setTimeout(() => { if (toast.parentElement) toast.remove(); }, 4500);
}

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

// ==================== MOBILE SWIPE NAVIGATION ====================
function setupMobileSwipe() {
    const mainContent = document.getElementById('main-content') || document.body;
    mainContent.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX;
    });
    mainContent.addEventListener('touchend', e => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    });
}

function handleSwipe() {
    const threshold = 80;
    const diff = touchStartX - touchEndX;
    if (Math.abs(diff) < threshold) return;

    const currentPage = getCurrentVisiblePage();
    if (diff > 0) {
        if (currentPage === 'home') navigateTo('marketplace');
        else if (currentPage === 'marketplace') navigateTo('services');
    } else {
        if (currentPage === 'services') navigateTo('marketplace');
        else if (currentPage === 'marketplace') navigateTo('home');
    }
}

function getCurrentVisiblePage() {
    if (document.getElementById('home-section').style.display !== 'none') return 'home';
    if (document.getElementById('marketplace-section').style.display !== 'none') return 'marketplace';
    if (document.getElementById('services-section').style.display !== 'none') return 'services';
    return 'home';
}

// ==================== SIDEBAR ====================
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar-menu');
    const overlay = document.getElementById('sidebar-overlay');
    if (!sidebar || !overlay) return;

    if (sidebar.classList.contains('-translate-x-full')) {
        sidebar.classList.remove('-translate-x-full');
        overlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    } else {
        sidebar.classList.add('-translate-x-full');
        overlay.classList.add('hidden');
        document.body.style.overflow = 'visible';
    }
}

// ==================== MODALS ====================
function showLoginModal() {
    toggleSidebar();
    const modal = document.getElementById('login-modal');
    if (modal) modal.classList.remove('hidden').classList.add('flex');
}

function hideLoginModal() {
    const modal = document.getElementById('login-modal');
    if (modal) modal.classList.add('hidden').classList.remove('flex');
}

function showSignupModal() {
    toggleSidebar();
    const modal = document.getElementById('signup-modal');
    if (modal) modal.classList.remove('hidden').classList.add('flex');
}

function hideSignupModal() {
    const modal = document.getElementById('signup-modal');
    if (modal) modal.classList.add('hidden').classList.remove('flex');
}

function showPostListingModal(editListing = null) {
    const modal = document.getElementById('post-listing-modal');
    if (!modal) return;

    currentEditingId = editListing ? editListing.id : null;
    modal.classList.remove('hidden').classList.add('flex');
    resetPostForm();

    if (editListing) {
        document.getElementById('modal-title').textContent = 'Edit Listing';
        document.getElementById('submit-listing-btn').textContent = 'Update Listing';

        document.getElementById('listing-type').value = editListing.type || 'item';
        document.getElementById('listing-category').value = editListing.category || 'General';
        document.getElementById('listing-title').value = editListing.title || '';
        document.getElementById('listing-price').value = editListing.price || '';
        document.getElementById('listing-desc').value = editListing.description || '';
        document.getElementById('seller-location').value = editListing.seller_location || 'Malawi';
        document.getElementById('seller-phone').value = editListing.seller_phone || '';
        document.getElementById('seller-whatsapp').value = editListing.seller_whatsapp || '';

        let imgs = editListing.images || [];
        if (typeof imgs === 'string') {
            try { imgs = JSON.parse(imgs); } catch(e) { imgs = imgs ? [imgs] : []; }
        }
        existingImages = Array.isArray(imgs) ? [...imgs] : [];

        toggleSubServiceField();
        if (editListing.type === 'service') {
            document.getElementById('sub-service').value = editListing.sub_category || '';
        }
        renderPreviews();
    } else {
        document.getElementById('modal-title').textContent = 'Post New Listing';
        document.getElementById('submit-listing-btn').textContent = 'Submit Listing';
        toggleSubServiceField();
    }
}

function hidePostListingModal() {
    const modal = document.getElementById('post-listing-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    currentEditingId = null;
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

function getFirstImage(images) {
    if (!images) return 'https://picsum.photos/id/1015/400/300';
    if (Array.isArray(images) && images.length > 0) return images[0];
    if (typeof images === 'string') {
        try {
            const parsed = JSON.parse(images);
            return Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : images;
        } catch (e) { return images; }
    }
    return 'https://picsum.photos/id/1015/400/300';
}

// ==================== SUB SERVICES ====================
const subServicesList = {
    "Cleaning": ["Home Cleaning", "Office Cleaning", "Car Wash"],
    "Repair": ["Plumbing", "Electrical", "Carpentry", "Appliance Repair"],
    "Tutoring": ["Mathematics", "English", "Sciences", "Business"],
    "Beauty": ["Hair Dressing", "Makeup", "Nail Care", "Massage"],
    "Transport": ["Taxi", "Delivery", "Moving Services", "Airport Transfer"],
    "Photography": ["Event Photography", "Product Photography", "Portrait"],
    "Event": ["DJ Services", "Catering", "Decoration"]
};

function toggleSubServiceField() {
    const listingType = document.getElementById('listing-type').value;
    const container = document.getElementById('sub-service-container');
    const select = document.getElementById('sub-service');

    if (listingType === 'service') {
        container.classList.remove('hidden');
        select.innerHTML = '<option value="">Select Sub Service</option>';
        Object.keys(subServicesList).forEach(cat => {
            const group = document.createElement('optgroup');
            group.label = cat;
            subServicesList[cat].forEach(sub => {
                const opt = document.createElement('option');
                opt.value = sub;
                opt.textContent = sub;
                group.appendChild(opt);
            });
            select.appendChild(group);
        });
    } else {
        container.classList.add('hidden');
    }
}

// ==================== NAVIGATION ====================
function navigateTo(page) {
    document.querySelectorAll('section').forEach(sec => sec.style.display = 'none');

    if (page === 'home') {
        document.getElementById('home-section').style.display = 'block';
        renderTrending();
        renderHomeServices();
    } 
    else if (page === 'services') {
        document.getElementById('services-section').style.display = 'block';
        servicesPage = 1;
        filterServices();
    } 
    else if (page === 'marketplace') {
        document.getElementById('marketplace-section').style.display = 'block';
        marketplacePage = 1;
        filterMarketplace();
    } 
    else if (page === 'sell') {
        showPostListingModal();
    } 
    else if (page === 'help') {
        openWhatsAppForRequest();
    }
}

function openWhatsAppForRequest() {
    const message = encodeURIComponent("Hello, I need urgent help on Simpo Malawi.");
    window.open(`https://wa.me/265883944589?text=${message}`, '_blank');
}

// ==================== AUTH UI ====================
function updateAuthUI(isLoggedIn, username = "", role = "") {
    const userInfo = document.getElementById('sidebar-user-info');
    const loggedInSection = document.getElementById('sidebar-logged-in');
    const loggedOutSection = document.getElementById('sidebar-logged-out');
    const adminLink = document.getElementById('sidebar-admin-link');
    const bottomDashboardBtn = document.getElementById('bottom-dashboard-btn');

    if (isLoggedIn) {
        document.getElementById('sidebar-username').textContent = username;
        document.getElementById('sidebar-role').textContent = role || "Member";

        if (userInfo) userInfo.classList.remove('hidden');
        if (loggedInSection) loggedInSection.classList.remove('hidden');
        if (loggedOutSection) loggedOutSection.classList.add('hidden');

        if (role === 'admin') {
            if (adminLink) adminLink.classList.remove('hidden');
            if (bottomDashboardBtn) {
                bottomDashboardBtn.classList.remove('hidden');
                bottomDashboardBtn.onclick = () => showAdminDashboard();
            }
        } else {
            if (adminLink) adminLink.classList.add('hidden');
            if (bottomDashboardBtn) {
                bottomDashboardBtn.classList.remove('hidden');
                bottomDashboardBtn.onclick = () => showSellerDashboard();
            }
        }
    } else {
        if (userInfo) userInfo.classList.add('hidden');
        if (loggedInSection) loggedInSection.classList.add('hidden');
        if (loggedOutSection) loggedOutSection.classList.remove('hidden');
        if (adminLink) adminLink.classList.add('hidden');
        if (bottomDashboardBtn) bottomDashboardBtn.classList.add('hidden');
    }
}

function updateProfileUI() {
    const loginBtn = document.getElementById('login-btn');
    const dashboardContainer = document.getElementById('dashboard-icon-container');
    if (currentUser) {
        if (loginBtn) loginBtn.classList.add('hidden');
        if (dashboardContainer) dashboardContainer.classList.remove('hidden');
    } else {
        if (loginBtn) loginBtn.classList.remove('hidden');
        if (dashboardContainer) dashboardContainer.classList.add('hidden');
    }
}

// ==================== HOME RENDERING ====================
function renderHomeServices() {
    const container = document.getElementById('home-services-grid');
    if (!container) return;
    container.innerHTML = '';

    allServices.slice(0, 8).forEach(item => {
        const imageUrl = getFirstImage(item.images);
        const card = document.createElement('div');
        card.className = "bg-white rounded-3xl overflow-hidden shadow hover:shadow-xl cursor-pointer transition-all";
        card.innerHTML = `
            <img src="${imageUrl}" onerror="this.src='https://picsum.photos/id/1015/400/300'" class="w-full h-48 object-cover bg-gray-200">
            <div class="p-6">
                <h4 class="font-semibold text-lg">${item.title}</h4>
                <p class="text-blue-600 font-bold text-xl mt-2">K ${Number(item.price).toLocaleString()}</p>
                <p class="text-sm text-gray-500 mt-1">📍 ${item.seller_location || 'Malawi'}</p>
            </div>
        `;
        card.onclick = () => showProductDetail(item.id);
        container.appendChild(card);
    });
}

function renderTrending() {
    renderProducts('trending-grid', allProducts.slice(0, 8));
}

// ==================== IMAGE HANDLING ====================
function handleImageUpload(e) {
    const files = Array.from(e.target.files);
    if (uploadedImages.length + existingImages.length + files.length > 6) {
        return showToast("Maximum 6 images allowed!", "warning");
    }
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

    existingImages.forEach((src, i) => {
        const div = document.createElement('div');
        div.className = "aspect-square rounded-2xl overflow-hidden border relative";
        div.innerHTML = `<img src="${src}" class="w-full h-full object-cover"><button onclick="removeExistingImage(${i}); event.stopImmediatePropagation()" class="absolute top-1 right-1 bg-red-600 text-white w-6 h-6 rounded-full text-xs">×</button>`;
        container.appendChild(div);
    });

    uploadedImages.forEach((src, i) => {
        const div = document.createElement('div');
        div.className = "aspect-square rounded-2xl overflow-hidden border relative";
        div.innerHTML = `<img src="${src}" class="w-full h-full object-cover"><button onclick="removePreviewImage(${i}); event.stopImmediatePropagation()" class="absolute top-1 right-1 bg-red-600 text-white w-6 h-6 rounded-full text-xs">×</button>`;
        container.appendChild(div);
    });
}

function removeExistingImage(index) {
    existingImages.splice(index, 1);
    renderPreviews();
}

function removePreviewImage(index) {
    uploadedImages.splice(index, 1);
    imageFiles.splice(index, 1);
    renderPreviews();
}

async function uploadImagesToStorage() {
    const imageUrls = [];
    for (let file of imageFiles) {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `listings/${fileName}`;
            const { error } = await supabaseClient.storage.from('listings').upload(filePath, file, { upsert: true });
            if (error) continue;
            const { data: { publicUrl } } = supabaseClient.storage.from('listings').getPublicUrl(filePath);
            imageUrls.push(publicUrl);
        } catch (err) {
            console.error(err);
        }
    }
    return imageUrls;
}

// ==================== SUBMIT / UPDATE LISTING ====================
async function submitListing() {
    const btnId = 'submit-listing-btn';
    showButtonLoading(btnId, currentEditingId ? 'Updating...' : 'Submitting...');

    if (!currentUser) {
        hideButtonLoading(btnId);
        return showToast("Please login first", "error");
    }

    if (existingImages.length + uploadedImages.length === 0) {
        hideButtonLoading(btnId);
        return showToast("Please upload at least one image", "error");
    }

    const listingType = document.getElementById('listing-type').value || 'item';
    const mainCategory = document.getElementById('listing-category').value || 'General';
    const subService = document.getElementById('sub-service').value || '';

    const finalTitle = document.getElementById('listing-title').value.trim();
    const price = parseFloat(document.getElementById('listing-price').value);

    if (!finalTitle || isNaN(price) || price <= 0) {
        hideButtonLoading(btnId);
        return showToast("Title and valid price are required", "error");
    }

    const newImageUrls = await uploadImagesToStorage();
    const finalImages = [...existingImages, ...newImageUrls];

    const payload = {
        title: finalTitle,
        price: price,
        category: mainCategory,
        sub_category: subService,
        type: listingType,
        description: document.getElementById('listing-desc').value.trim() || '',
        seller_location: document.getElementById('seller-location').value.trim() || "Malawi",
        seller_phone: document.getElementById('seller-phone').value.trim() || '',
        seller_whatsapp: document.getElementById('seller-whatsapp').value.trim() || '',
        images: finalImages,
        updated_at: new Date().toISOString()
    };

    let error;
    if (currentEditingId) {
        let query = supabaseClient.from('listings').update(payload).eq('id', currentEditingId);
        if (currentUser.role !== 'admin') query = query.eq('seller_id', currentUser.id);
        ({ error } = await query);
    } else {
        payload.seller_id = currentUser.id;
        payload.seller_name = currentUser.name || 'Seller';
        payload.status = 'pending';
        ({ error } = await supabaseClient.from('listings').insert(payload));
    }

    hideButtonLoading(btnId);

    if (error) {
        showToast("Error: " + error.message, "error");
    } else {
        showToast(currentEditingId ? "Listing updated successfully!" : `${listingType === 'service' ? 'Service' : 'Product'} submitted successfully!`, "success");
        hidePostListingModal();
        resetPostForm();
        loadMyListings();
        loadProducts();
        loadServices();
        if (currentUser.role === 'admin') {
            loadPendingListings();
            loadLiveListingsForAdmin();
            loadAdminStats();
        }
    }
}

function resetPostForm() {
    uploadedImages = [];
    imageFiles = [];
    existingImages = [];
    currentEditingId = null;
    renderPreviews();

    document.getElementById('listing-type').value = 'item';
    const fields = ['listing-title','listing-price','listing-desc','seller-location','seller-phone','seller-whatsapp'];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
}

// ==================== SELLER DASHBOARD ====================
function showSellerDashboard() {
    if (currentUser && currentUser.role === 'admin') {
        return showAdminDashboard();
    }
    document.querySelectorAll('section').forEach(s => s.style.display = 'none');
    document.getElementById('seller-dashboard').style.display = 'block';
    document.getElementById('seller-name').textContent = currentUser?.name || 'Seller';
    loadMyListings();
    loadSellerStats();
}

async function loadSellerStats() {
    if (!currentUser || currentUser.role === 'admin') return;
    const { data } = await supabaseClient.from('listings').select('status').eq('seller_id', currentUser.id);
    const total = data ? data.length : 0;
    const pending = data ? data.filter(l => l.status === 'pending').length : 0;
    const approved = data ? data.filter(l => l.status === 'approved').length : 0;
    const sold = data ? data.filter(l => l.status === 'sold').length : 0;

    document.getElementById('seller-total').textContent = total;
    document.getElementById('seller-pending').textContent = pending;
    document.getElementById('seller-approved').textContent = approved;
    document.getElementById('seller-sold').textContent = sold;
}

async function loadMyListings() {
    if (!currentUser || currentUser.role === 'admin') return;
    const { data } = await supabaseClient.from('listings').select('*').eq('seller_id', currentUser.id).order('created_at', { ascending: false });
    const container = document.getElementById('my-listings-container');
    container.innerHTML = '';

    if (!data || data.length === 0) {
        container.innerHTML = `<div class="text-center py-16"><i class="fa-solid fa-box-open text-6xl text-gray-300 mb-4"></i><p class="text-gray-500">You haven't posted any listings yet.</p><button onclick="showPostListingModal()" class="mt-6 px-8 py-3 bg-blue-600 text-white rounded-3xl hover:bg-blue-700">Post Your First Listing</button></div>`;
        return;
    }

    data.forEach(listing => {
        const div = document.createElement('div');
        div.className = "border border-gray-100 rounded-3xl p-5 sm:p-6 bg-white flex flex-col sm:flex-row gap-5 hover:shadow-md transition-all";
        div.innerHTML = `
            <img src="${getFirstImage(listing.images)}" class="w-full sm:w-28 h-48 sm:h-28 object-cover rounded-2xl flex-shrink-0">
            <div class="flex-1 min-w-0">
                <h4 class="font-semibold text-lg leading-tight line-clamp-2">${listing.title}</h4>
                <p class="text-blue-700 font-bold text-xl mt-2">K ${Number(listing.price).toLocaleString()}</p>
                <p class="text-sm text-gray-500 mt-1">${listing.seller_location || 'Malawi'}</p>
                <div class="mt-4">
                    <span class="inline-block px-4 py-1 text-xs font-medium rounded-full ${listing.status === 'approved' ? 'bg-green-100 text-green-700' : listing.status === 'sold' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">
                        ${listing.status ? listing.status.toUpperCase() : 'PENDING'}
                    </span>
                </div>
            </div>
            <div class="flex flex-col justify-between items-end gap-3">
                <button onclick="editListing('${listing.id}'); event.stopImmediatePropagation()" class="px-6 py-2.5 bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium rounded-2xl">Edit</button>
                ${listing.status !== 'sold' ? `<button onclick="markAsSold('${listing.id}'); event.stopImmediatePropagation()" class="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-2xl">Mark as Sold</button>` : `<span class="text-emerald-600 font-semibold">✓ Sold</span>`}
            </div>
        `;
        container.appendChild(div);
    });
}

async function editListing(id) {
    const { data } = await supabaseClient.from('listings').select('*').eq('id', id).single();
    if (data) showPostListingModal(data);
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
    const { data } = await supabaseClient.from('listings').select('status, price');
    if (!data) return;
    
    const pending = data.filter(l => l.status === 'pending').length;
    const live = data.filter(l => l.status === 'approved').length;
    const sold = data.filter(l => l.status === 'sold').length;
    const rejected = data.filter(l => l.status === 'rejected').length;

    document.getElementById('admin-pending-count').textContent = pending;
    document.getElementById('admin-live-count').textContent = live;
    document.getElementById('admin-total-count').textContent = data.length;
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
        row.className = "hover:bg-gray-50";
        row.innerHTML = `
            <td class="py-4">
                <div class="flex items-center gap-3">
                    <img src="${getFirstImage(listing.images)}" class="w-12 h-12 object-cover rounded-xl">
                    <span>${listing.title}</span>
                </div>
            </td>
            <td class="py-4">${listing.seller_name || listing.seller_phone || 'N/A'}</td>
            <td class="py-4 font-medium">K ${Number(listing.price).toLocaleString()}</td>
            <td class="py-4 text-center">
                <button onclick="approveListing('${listing.id}')" class="bg-blue-600 text-white px-5 py-2 rounded-2xl text-sm mr-2 hover:bg-blue-700">Approve</button>
                <button onclick="rejectListing('${listing.id}')" class="bg-red-600 text-white px-5 py-2 rounded-2xl text-sm hover:bg-red-700">Reject</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function loadLiveListingsForAdmin() {
    const { data } = await supabaseClient.from('listings').select('*').eq('status', 'approved');
    const container = document.getElementById('admin-live-products');
    container.innerHTML = '';

    if (!data || data.length === 0) {
        document.getElementById('admin-live-empty').classList.remove('hidden');
        return;
    }
    document.getElementById('admin-live-empty').classList.add('hidden');

    data.forEach(listing => {
        const div = document.createElement('div');
        div.className = "bg-white border rounded-3xl p-6 shadow hover:shadow-xl transition-all";
        div.innerHTML = `
            <img src="${getFirstImage(listing.images)}" onerror="this.src='https://picsum.photos/id/1015/400/300'" class="w-full h-48 object-cover rounded-2xl mb-4">
            <h4 class="font-semibold text-lg">${listing.title}</h4>
            <p class="text-blue-700 font-bold text-xl">K ${Number(listing.price).toLocaleString()}</p>
        `;
        container.appendChild(div);
    });
}

async function approveListing(id) {
    await supabaseClient.from('listings').update({ status: 'approved' }).eq('id', id);
    showToast("Listing approved!", "success");
    loadPendingListings();
    loadLiveListingsForAdmin();
    loadAdminStats();
    loadProducts();
    loadServices();
}

async function rejectListing(id) {
    if (!confirm("Reject this listing?")) return;
    await supabaseClient.from('listings').update({ status: 'rejected' }).eq('id', id);
    showToast("Listing rejected", "warning");
    loadPendingListings();
    loadAdminStats();
}

async function markAsSold(id) {
    if (confirm("Mark as sold?")) {
        await supabaseClient.from('listings').update({ status: 'sold' }).eq('id', id);
        showToast("Marked as sold!", "success");
        loadMyListings();
        loadProducts();
        loadServices();
        if (currentUser?.role === 'admin') {
            loadAdminStats();
            loadLiveListingsForAdmin();
        }
    }
}

// ==================== SEARCH & FILTERS ====================
function performSearch() {
    let query = '';
    const desktop = document.getElementById('search-input-desktop');
    const mobile = document.getElementById('search-input-mobile');

    if (desktop && desktop.value.trim()) query = desktop.value.toLowerCase().trim();
    else if (mobile && mobile.value.trim()) query = mobile.value.toLowerCase().trim();

    if (!query) {
        const isMarketplace = document.getElementById('marketplace-section').style.display !== 'none';
        const isServices = document.getElementById('services-section').style.display !== 'none';
        if (isMarketplace) filterMarketplace();
        else if (isServices) filterServices();
        else navigateTo('home');
        return;
    }

    const productResults = allProducts.filter(p => 
        (p.title || '').toLowerCase().includes(query) || 
        (p.description || '').toLowerCase().includes(query) ||
        (p.category || '').toLowerCase().includes(query)
    );

    const serviceResults = allServices.filter(s => 
        (s.title || '').toLowerCase().includes(query) || 
        (s.description || '').toLowerCase().includes(query) ||
        (s.category || '').toLowerCase().includes(query)
    );

    if (productResults.length > 0) {
        navigateTo('marketplace');
        currentFilteredProducts = productResults;
        marketplacePage = 1;
        renderProducts('marketplace-grid', currentFilteredProducts.slice(0, PAGE_SIZE));
        updateLoadMoreButton('load-more-btn', currentFilteredProducts);
    } else if (serviceResults.length > 0) {
        navigateTo('services');
        renderServicesPaginatedWithData(serviceResults);
    } else {
        showToast("No results found for your search", "warning");
    }
}

function filterMarketplace() {
    const category = document.getElementById('category-filter')?.value || '';
    const locationFilter = (document.getElementById('marketplace-location-filter')?.value || '').toLowerCase().trim();
    const minPrice = parseFloat(document.getElementById('marketplace-min-price')?.value) || 0;
    const maxPrice = parseFloat(document.getElementById('marketplace-max-price')?.value) || Infinity;

    let filtered = allProducts.filter(p => {
        const matchCat = !category || p.category === category;
        const matchLoc = !locationFilter || (p.seller_location || '').toLowerCase().includes(locationFilter);
        const matchPrice = p.price >= minPrice && p.price <= maxPrice;
        return matchCat && matchLoc && matchPrice;
    });

    currentFilteredProducts = filtered;
    marketplacePage = 1;
    renderProducts('marketplace-grid', currentFilteredProducts.slice(0, PAGE_SIZE));
    updateLoadMoreButton('load-more-btn', currentFilteredProducts);
}

function filterServices() {
    const category = document.getElementById('service-category-filter')?.value || '';
    const locationFilter = (document.getElementById('service-location-filter')?.value || '').toLowerCase().trim();
    const minPrice = parseFloat(document.getElementById('service-min-price')?.value) || 0;
    const maxPrice = parseFloat(document.getElementById('service-max-price')?.value) || Infinity;

    let filtered = allServices.filter(s => {
        const matchCat = !category || s.category === category;
        const matchLoc = !locationFilter || (s.seller_location || '').toLowerCase().includes(locationFilter);
        const matchPrice = s.price >= minPrice && s.price <= maxPrice;
        return matchCat && matchLoc && matchPrice;
    });

    currentFilteredServices = filtered;
    servicesPage = 1;
    renderServicesPaginated();
}

// ==================== RENDER FUNCTIONS ====================
function renderProducts(containerId, list, append = false) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!append) container.innerHTML = '';

    if (!list || list.length === 0) {
        if (!append) container.innerHTML = `<p class="col-span-full text-center py-12 text-gray-500">No items found.</p>`;
        return;
    }

    list.forEach(product => {
        const imageUrl = getFirstImage(product.images);
        const rating = (4 + Math.random() * 1).toFixed(1);
        const card = document.createElement('div');
        card.className = "product-card bg-white rounded-3xl overflow-hidden cursor-pointer shadow hover:shadow-xl transition-all";
        card.innerHTML = `
            <img src="${imageUrl}" onerror="this.src='https://picsum.photos/id/1015/400/300'" class="w-full h-64 object-cover bg-gray-200">
            <div class="p-6">
                <h4 class="font-semibold text-lg mb-2">${product.title}</h4>
                <div class="flex justify-between items-center mb-3">
                    <span class="px-3 py-1 bg-blue-100 text-blue-700 text-xs rounded-3xl">${product.category || 'General'}</span>
                    <div class="flex items-center gap-1 text-amber-500 text-sm">★ <span>${rating}</span></div>
                </div>
                <p class="text-blue-700 font-bold text-2xl">K ${Number(product.price).toLocaleString()}</p>
                <p class="text-sm text-gray-600 mt-2">📍 ${product.seller_location || 'Malawi'}</p>
                <div class="mt-6 flex gap-3" onclick="event.stopImmediatePropagation()">
                    <button onclick="event.stopImmediatePropagation(); contactSeller('${product.id}', 'phone')" class="flex-1 py-3 bg-gray-100 hover:bg-gray-200 rounded-2xl text-sm">📞 Call</button>
                    <button onclick="event.stopImmediatePropagation(); contactSeller('${product.id}', 'whatsapp')" class="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-2xl text-sm"><i class="fa-brands fa-whatsapp"></i> WhatsApp</button>
                </div>
            </div>
        `;
        card.addEventListener('click', (e) => {
            if (!e.target.closest('button')) showProductDetail(product.id);
        });
        container.appendChild(card);
    });
}

function renderServicesPaginated() {
    const container = document.getElementById('services-grid');
    if (!container) return;
    if (servicesPage === 1) container.innerHTML = '';

    const start = (servicesPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageItems = currentFilteredServices.slice(start, end);

    pageItems.forEach(item => {
        const imageUrl = getFirstImage(item.images);
        const subCategoryHTML = item.sub_category ? `<span class="inline-block mt-2 px-4 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-3xl">${item.sub_category}</span>` : '';

        const card = document.createElement('div');
        card.className = "bg-white rounded-3xl overflow-hidden shadow hover:shadow-xl cursor-pointer transition-all";
        card.innerHTML = `
            <img src="${imageUrl}" onerror="this.src='https://picsum.photos/id/1015/400/300'" class="w-full h-56 object-cover bg-gray-200">
            <div class="p-6">
                <h4 class="font-semibold text-lg">${item.title}</h4>
                ${subCategoryHTML}
                <p class="text-blue-600 font-bold text-2xl mt-3">K ${Number(item.price).toLocaleString()}</p>
                <p class="text-sm text-gray-500 mt-1">📍 ${item.seller_location || 'Malawi'}</p>
                <p class="text-gray-600 mt-4 line-clamp-3">${item.description || ''}</p>
                <div class="mt-6 flex gap-3">
                    <button onclick="event.stopImmediatePropagation(); contactSeller('${item.id}', 'phone')" class="flex-1 py-3 bg-gray-100 hover:bg-gray-200 rounded-2xl text-sm">📞 Call</button>
                    <button onclick="event.stopImmediatePropagation(); contactSeller('${item.id}', 'whatsapp')" class="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-2xl text-sm"><i class="fa-brands fa-whatsapp"></i> WhatsApp</button>
                </div>
            </div>
        `;
        card.addEventListener('click', () => showProductDetail(item.id));
        container.appendChild(card);
    });

    updateLoadMoreButton('load-more-services-btn', currentFilteredServices);
}

function updateLoadMoreButton(btnId, filteredArray) {
    const loadBtn = document.getElementById(btnId);
    if (!loadBtn) return;
    const currentPage = (btnId === 'load-more-btn') ? marketplacePage : servicesPage;
    const hasMore = (currentPage * PAGE_SIZE) < filteredArray.length;
    loadBtn.style.display = hasMore ? 'block' : 'none';
}

function renderServicesPaginatedWithData(data) {
    currentFilteredServices = data || [];
    servicesPage = 1;
    renderServicesPaginated();
}

function loadMoreMarketplace() {
    marketplacePage++;
    const start = (marketplacePage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const newItems = currentFilteredProducts.slice(start, end);
    if (newItems.length > 0) renderProducts('marketplace-grid', newItems, true);
    updateLoadMoreButton('load-more-btn', currentFilteredProducts);
}

function loadMoreServices() {
    servicesPage++;
    renderServicesPaginated();
}

// ==================== PRODUCT DETAIL ====================
function showProductDetail(id) {
    currentProduct = allProducts.find(p => String(p.id) === String(id)) || allServices.find(s => String(s.id) === String(id));
    if (!currentProduct) return showToast("Item not found.", "error");

    document.getElementById('detail-title').textContent = currentProduct.title;
    document.getElementById('detail-price').textContent = `K ${Number(currentProduct.price).toLocaleString()}`;
    document.getElementById('detail-desc').textContent = currentProduct.description || "No description provided.";

    const imagesContainer = document.getElementById('detail-images');
    imagesContainer.innerHTML = '';

    let images = currentProduct.images || [];
    if (typeof images === 'string') {
        try { images = JSON.parse(images); } catch(e) { images = images ? [images] : []; }
    }
    if (!Array.isArray(images) || images.length === 0) images = ["https://picsum.photos/id/1015/800/600"];

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

    document.getElementById('detail-call-btn').onclick = () => phone ? window.location.href = `tel:${phone}` : showToast("No phone available", "warning");
    document.getElementById('detail-whatsapp-btn').onclick = () => wa ? window.open(`https://wa.me/${wa}`, '_blank') : showToast("No WhatsApp available", "warning");

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
    const product = allProducts.find(p => String(p.id) === String(id)) || allServices.find(s => String(s.id) === String(id));
    if (!product) return;

    const phone = product.seller_phone || '';
    let wa = (product.seller_whatsapp || phone).replace(/[^0-9]/g, '');
    if (wa.length === 9) wa = '265' + wa;
    else if (wa.length === 10 && wa.startsWith('0')) wa = '265' + wa.substring(1);

    if (type === 'phone' && phone) window.location.href = `tel:${phone}`;
    if (type === 'whatsapp' && wa) window.open(`https://wa.me/${wa}`, '_blank');
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
        return showToast("All fields are required", "error");
    }

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const fakeEmail = `user.${cleanPhone}@malawimarket.local`;

    const { error } = await supabaseClient.auth.signUp({
        email: fakeEmail,
        password: password,
        options: { data: { full_name: fullName, phone: phone, role: 'seller' } }
    });

    hideButtonLoading(btnId);
    if (error) {
        showToast("Signup error: " + error.message, "error");
    } else {
        showToast(`Account created! Please login with your phone.`, "success");
        hideSignupModal();
        showLoginModal();
    }
}

async function performLogin() {
    const btnId = 'login-submit-btn';
    showButtonLoading(btnId, 'Logging in...');

    const username = document.getElementById('login-username')?.value.trim();
    const password = document.getElementById('login-password')?.value.trim();

    // ADMIN LOGIN
    if (username === '0992961209' && password === 'Waiyatsa1651') {
        currentUser = { role: 'admin', name: "Macmillan Waiyatsa", id: 'admin' };
        hideButtonLoading(btnId);
        finishLogin();
        return;
    }

    if (!username || !password) {
        hideButtonLoading(btnId);
        return showToast("Phone number and password are required", "error");
    }

    const cleanPhone = username.replace(/[^0-9]/g, '');
    const fakeEmail = `user.${cleanPhone}@malawimarket.local`;

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: fakeEmail,
        password: password
    });

    hideButtonLoading(btnId);
    if (error) {
        return showToast("Login failed: " + error.message, "error");
    }

    currentUser = {
        role: 'seller',
        name: data.user?.user_metadata?.full_name || username,
        id: data.user.id
    };

    finishLogin();
}

function finishLogin() {
    updateAuthUI(true, currentUser.name, currentUser.role);
    updateProfileUI();
    hideLoginModal();
    showToast("Login successful!", "success");

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
        updateAuthUI(false);
        updateProfileUI();
        location.reload();
    }
}

// ==================== LOAD DATA ====================
async function loadProducts() {
    try {
        const { data } = await supabaseClient
            .from('listings')
            .select('*')
            .eq('status', 'approved')
            .not('type', 'eq', 'service')
            .order('created_at', { ascending: false })
            .limit(60);
        allProducts = data || [];
    } catch (e) {
        console.error(e);
    }
    renderTrending();
}

async function loadServices() {
    try {
        const { data } = await supabaseClient
            .from('listings')
            .select('*')
            .eq('type', 'service')
            .eq('status', 'approved')
            .order('created_at', { ascending: false });
        allServices = data || [];
        currentFilteredServices = data || [];
    } catch (e) {
        console.error(e);
    }
}

// ==================== START APPLICATION ====================
window.onload = async () => {
    await initSupabase();
    await checkAuthState();
    await loadProducts();
    await loadServices();

    updateAuthUI(false);
    navigateTo('home');
    setupMobileSwipe();

    console.log("✅ Simpo Malawi - Full JS with Admin-Only Dashboard Fix Loaded");
};
