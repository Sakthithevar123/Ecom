$(document).ready(function() {
    // Firebase Configuration for smallkart-157de
    const firebaseConfig = {
        apiKey: "AIzaSyDmDBN1U8UgEAZ-8reSphP0tZN-iEhNWlU",
        authDomain: "smallkart-157de.firebaseapp.com",
        projectId: "smallkart-157de",
        storageBucket: "smallkart-157de.appspot.com",
        messagingSenderId: "959248983215",
        appId: "1:959248983215:web:18d100b4f84ed427f8a05a",
        measurementId: "G-06JE1N07SK"
    };

    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    console.log("Firebase initialized successfully");
    const auth = firebase.auth();
    db = firebase.firestore();
    const googleProvider = new firebase.auth.GoogleAuthProvider();

    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    let total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    let totalCreditsEarned = cart.reduce((sum, item) => sum + (item.credits || 0) * item.quantity, 0);
    let creditsToUse = 0; // Track credits to use in-page
    let userCoins = 0; // Track user's coin balance

    // Add these variables at the top of your script, after Firebase initialization
    let currentPage = 1;
    const productsPerPage = 5;
    let totalPages = 1;

    // Add these variables at the top level where other variables are declared
    let adminCurrentPage = 1;
    const adminProductsPerPage = 5;

    // Add these at the top with other variables if not already there
    let customerCurrentPage = 1;
    const itemsPerPage = 5;

    // Add this debug log
    console.log("About to load categories...");
    loadCategories();
    
    // Add this to reload categories when admin view becomes visible
    auth.onAuthStateChanged(user => {
        if (user) {
            db.collection('users').doc(user.uid).get().then(doc => {
                if (doc.exists) {
                    const role = doc.data().role;
                    console.log("User role:", role);
                    if (role === 'admin') {
                        console.log("Admin logged in, reloading categories");
                        loadCategories();
                    }
                }
            });
        }
    });

    // Add this at the top of your script file
    let productsUnsubscribe = null;

    // Function to load image as base64 (for the logo) with path validation
    function loadImageAsBase64(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = function() {
                const canvas = document.createElement('canvas');
                canvas.width = this.width;
                canvas.height = this.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(this, 0, 0);
                const dataURL = canvas.toDataURL('image/jpeg');
                resolve(dataURL);
            };
            img.onerror = function() {
                console.error(`Failed to load image from ${url}. Ensure 'logo.jpg' exists in the project root.`);
                reject(new Error(`Failed to load image from ${url}`));
            };
            img.src = url; // 'logo.jpg' in the root
        });
    }

    // Function to convert file to base64
    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function() {
                resolve(reader.result);
            };
            reader.onerror = function() {
                reject(new Error('Failed to read file as base64'));
            };
            reader.readAsDataURL(file);
        });
    }

    // Reusable function to generate PDF with improved layout
    async function generatePDF(orderId, dateText, $itemsList, originalTotal, remainingPaid, creditsUsed, creditsEarned, totalCredits, cashProportion, save = false) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 20;
        const contentWidth = pageWidth - 2 * margin;

        let logoDataUrl = null;
        try {
            logoDataUrl = await loadImageAsBase64('logo.jpg');
            console.log('Logo loaded successfully');
        } catch (error) {
            console.warn('Logo loading failed, proceeding without logo:', error.message);
        }

        const headerY = margin;
        if (logoDataUrl) {
            const logoWidth = 30;
            const logoHeight = 30;
            const logoX = margin;
            doc.addImage(logoDataUrl, 'JPEG', logoX, headerY, logoWidth, logoHeight);
        } else {
            doc.setFontSize(18);
            doc.setFont("helvetica", "bold");
            doc.text("SmallKart", margin, headerY + 10);
        }

        doc.setFontSize(16);
        doc.setFont("helvetica", "normal");
        const titleY = headerY + (logoDataUrl ? 40 : 20);
        doc.text("Purchase Receipt", margin, titleY);

        doc.setLineWidth(0.5);
        doc.line(margin, titleY + 5, pageWidth - margin, titleY + 5);

        const contentY = titleY + 15;
        let yPosition = contentY;

        doc.rect(margin, contentY - 5, contentWidth, 120, 'S');

        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text(` Receipt No: ${orderId}`, margin, yPosition);
        yPosition += 10;

        doc.text(` Date: ${dateText}`, margin, yPosition);
        yPosition += 10;

        doc.setFont("helvetica", "bold");
        doc.text(" Items:", margin, yPosition);
        yPosition += 10;

        doc.setFont("helvetica", "normal");
        const items = $itemsList.find('li').map(function() {
            return $(this).text().trim();
        }).get();
        const leftOffset = margin + 5;
        items.forEach(item => {
            const itemLines = doc.splitTextToSize(item, contentWidth - 5);
            doc.text(itemLines, leftOffset, yPosition);
            yPosition += itemLines.length * 8;
        });
        yPosition += 10;

        doc.setFont("helvetica", "bold");
        doc.text(` Subtotal: $${originalTotal.toFixed(2)}`, margin, yPosition);
        yPosition += 10;

        doc.setFont("helvetica", "normal");
        doc.text(` Credits Used: ${creditsUsed} ($${(creditsUsed * 1000).toFixed(2)})`, margin, yPosition);
        yPosition += 10;

        doc.text(` Net Credits Received: ${creditsEarned}`, margin, yPosition);
        yPosition += 10;

        doc.text(` Remaining Paid: $${remainingPaid.toFixed(2)}`, margin, yPosition);
        yPosition += 10;

        doc.setFont("helvetica", "bold");
        doc.text(` Total: $${remainingPaid.toFixed(2)}`, margin, yPosition);
        yPosition += 15;

        doc.setLineWidth(0.5);
        doc.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += 10;

        doc.setFontSize(10);
        doc.setFont("helvetica", "italic");
        doc.text("Thank you for shopping with SmallKart!", pageWidth / 2, yPosition, { align: 'center' });

        yPosition += 10;
        doc.setFontSize(8);
        doc.text(`Note: Net Credits Received are calculated as the total potential credits (${totalCredits}) multiplied by the proportion of the payment made with cash (${(cashProportion * 100).toFixed(1)}% of the total amount), then rounded down to the nearest whole number.`, margin, yPosition, { 
            maxWidth: contentWidth,
            align: 'left'
        });

        if (yPosition > pageHeight - margin) {
            doc.addPage();
            yPosition = margin;
        }

        if (save) {
            doc.save('receipt.pdf');
            console.log('PDF saved successfully');
        }
        return null;
    }

    // Add this helper function at the top level
    function handleCOOPError(error) {
        if (error.message.includes('Cross-Origin-Opener-Policy')) {
            console.warn("Auth Window Warning:", error.message);
            return true; // Error was handled
        }
        return false; // Error needs normal handling
    }

    // Google Login Handler with Automatic Registration
    $('#google-login-btn').click(function() {
        console.log("Login button clicked (Google)");
        $('#login-loading').removeClass('hidden');
        
        try {
        auth.signInWithPopup(googleProvider)
            .then(result => {
                console.log("Sign-in successful (Google)", result.user);
                const user = result.user;
                return auth.onAuthStateChanged(user => {
                    if (user) {
                        return db.collection('users').doc(user.uid).get()
                            .then(doc => {
                                if (!doc.exists) {
                                    return db.collection('users').doc(user.uid).set({
                                        email: user.email,
                                        role: "customer",
                                        coins: 0
                                    }).then(() => handleUserLogin(user));
                                }
                                return handleUserLogin(user);
                            });
                    } else {
                        throw new Error("User not authenticated.");
                    }
                });
            })
            .catch(error => {
                    if (!handleCOOPError(error)) {
                console.error("Login error (Google)", error.message);
                showError(error.message);
                    }
            })
            .finally(() => {
                $('#login-loading').addClass('hidden');
            });
        } catch (e) {
            if (e.message.includes('cross-origin')) {
                console.warn("Cross-Origin Warning:", e.message);
            } else {
                throw e;
            }
        }
    });

    // Handle User Login (Common Logic)
    function handleUserLogin(user) {
        console.log("Authenticated UID:", auth.currentUser?.uid);
        const userId = user.uid;
        return db.collection('users').doc(userId).get()
            .then(doc => {
                if (!doc.exists) {
                    throw new Error('User not registered. Contact admin to set your role.');
                }
                const { role, coins } = doc.data();
                userCoins = coins;
                localStorage.setItem('userId', userId);
                $('#auth-section').addClass('hidden');
                if (role === 'customer') {
                    $('#customer-view').removeClass('hidden');
                    displayProducts();
                    displayOrderHistory();
                    displayCoinBalance(coins);

                    db.collection('users').doc(userId).onSnapshot(doc => {
                        if (doc.exists) {
                            userCoins = doc.data().coins || 0;
                            console.log(`Real-time coin balance update: ${userCoins}`);
                            updateCoinBalance(userCoins);
                            updateCart();
                        }
                    });
                } else if (role === 'admin') {
                    $('#admin-view').removeClass('hidden');
                    displayAdminProducts();
                    // Add reports button and container
                    const reportsBtn = $('<button>')
                        .attr('id', 'admin-reports')
                        .addClass('btn btn-primary ms-2')
                        .text('Reports')
                        .click(() => {
                            // Toggle reports visibility
                            $('#reports-container').toggle();
                            loadTop10Orders();
                        });
                    
                    // Create reports container
                    const reportsContainer = $('<div>')
                        .attr('id', 'reports-container')
                        .addClass('mt-3')
                        .hide()
                        .html(`
                            <ul class="nav nav-tabs" role="tablist">
                                <li class="nav-item">
                                    <a class="nav-link active" data-bs-toggle="tab" href="#top10orders">Top 10 Orders</a>
                                </li>
                                <li class="nav-item">
                                    <a class="nav-link" data-bs-toggle="tab" href="#top10products">Top Products</a>
                                </li>
                                <li class="nav-item">
                                    <a class="nav-link" data-bs-toggle="tab" href="#top10customers">Top Customer</a>
                                </li>
                            </ul>
                            <div class="tab-content">
                                <div id="top10orders" class="tab-pane active">
                                    <div class="report-content"></div>
                                </div>
                                <div id="top10products" class="tab-pane">
                                    <div class="report-content"></div>
                                </div>
                                <div id="top10customers" class="tab-pane">
                                    <div class="report-content"></div>
                                </div>
                            </div>
                        `);
                    
                    $('.admin-controls').append(reportsBtn);
                    $('.admin-controls').after(reportsContainer);
                    initializeReports();
                } else {
                    throw new Error('Invalid role assigned.');
                }
            })
            .catch(error => {
                console.error("User role check error", error.message);
                showError(error.message);
            });
    }

    // Display Coin Balance
    function displayCoinBalance(coins) {
        $('#coin-balance').text(`Coin Balance: ${coins} Coins ($${coins * 1000})`);
    }

    // Update Coin Balance in UI
    function updateCoinBalance(coins) {
        $('#coin-balance').text(`Coin Balance: ${coins} Coins ($${coins * 1000})`);
    }

    // Logout Handlers
    $('#logout-customer, #logout-admin').click(function() {
        resetCart();
        auth.signOut().then(() => {
            $('#customer-view, #admin-view').addClass('hidden');
            $('#auth-section').removeClass('hidden');
            $('#bill-section').addClass('hidden');
            localStorage.removeItem('userId');
            localStorage.removeItem('cart');
            updateCart();
        });
    });

    // Reset cart function
    function resetCart() {
        cart.forEach(item => {
            db.collection('products').doc(item.id).update({
                stock: firebase.firestore.FieldValue.increment(item.quantity)
            });
        });
        cart = [];
        total = 0;
        totalCreditsEarned = 0;
        localStorage.setItem('cart', JSON.stringify(cart));
    }

    // Customer: Display Products with Real-Time Updates
    function displayProducts() {
        $('.products').empty();
        const selectedCategory = $('#category-filter').val();
        const seenProducts = new Set();
        
        if (productsUnsubscribe) {
            productsUnsubscribe();
        }
        
        db.collection('categories').get().then(categorySnapshot => {
            const categories = {};
            categorySnapshot.docs.forEach(doc => {
                categories[doc.id] = doc.data().name;
            });
            
            productsUnsubscribe = db.collection('products').onSnapshot(snapshot => {
            $('.products').empty();
                
                let allProducts = snapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(product => {
                        if (seenProducts.has(product.id)) return false;
                        seenProducts.add(product.id);
                        return !selectedCategory || selectedCategory === 'all' || product.categoryId === selectedCategory;
                    });

                const totalPages = Math.ceil(allProducts.length / itemsPerPage);
                customerCurrentPage = Math.min(Math.max(1, customerCurrentPage), totalPages);
                
                const startIndex = (customerCurrentPage - 1) * itemsPerPage;
                const endIndex = startIndex + itemsPerPage;
                const currentPageProducts = allProducts.slice(startIndex, endIndex);
                
                const productPromises = currentPageProducts.map(product => {
                let $product = $('<div>').addClass('product col-md-4').attr('data-id', product.id);
                $product.append($('<h3>').text(product.name));
                    const categoryName = categories[product.categoryId] || 'Uncategorized';
                    $product.append($('<p>').text(`Category: ${categoryName}`));
                $product.append($('<p>').text(`Price: $${product.price}`));
                $product.append($('<p>').text(`Stock: ${product.stock}`));
                $product.append($('<p>').text(`Credits Earned: ${product.credits || 0} per unit`));
                let $button = $('<button>').text('Add to Cart').addClass('btn btn-primary add-to-cart');
                if (product.stock === 0) $button.prop('disabled', true);
                $product.append($button);

                if (product.assetId) {
                    return db.collection('assets').doc(product.assetId).get().then(assetDoc => {
                        if (assetDoc.exists) {
                            const asset = assetDoc.data();
                            if (asset.url && asset.url.startsWith('data:image/')) {
                                $product.prepend($('<img>').attr('src', asset.url).addClass('img-fluid mb-2'));
                            }
                        }
                        return $product;
                    });
                }
                return Promise.resolve($product);
            });

            Promise.all(productPromises).then($products => {
                    $('.products').empty();
                $products.forEach($product => $('.products').append($product));
                    
                    // Update pagination controls
                    $('.pagination-controls').remove();
                    const $paginationControls = $('<div>').addClass('pagination-controls text-center mt-3');
                    const $prevBtn = $('<button>').text('« Previous').addClass('btn btn-secondary mx-2');
                    const $nextBtn = $('<button>').text('Next »').addClass('btn btn-secondary mx-2');
                    const $pageInfo = $('<span>').text(`Page ${customerCurrentPage} of ${totalPages}`).addClass('mx-2');
                    
                    $prevBtn.prop('disabled', customerCurrentPage === 1);
                    $nextBtn.prop('disabled', customerCurrentPage === totalPages);
                    
                    $prevBtn.click(() => {
                        if (customerCurrentPage > 1) {
                            customerCurrentPage--;
                            displayProducts();
                        }
                    });
                    
                    $nextBtn.click(() => {
                        if (customerCurrentPage < totalPages) {
                            customerCurrentPage++;
                            displayProducts();
                        }
                    });
                    
                    $paginationControls.append($prevBtn, $pageInfo, $nextBtn);
                    $('.products').after($paginationControls);
                    
                $('.add-to-cart').off('click').on('click', function() {
                    let $product = $(this).closest('.product');
                    let id = $product.attr('data-id');
                    db.collection('products').doc(id).get().then(doc => {
                        const product = { id: doc.id, ...doc.data() };
                        if (product.stock > 0) {
                            db.runTransaction(transaction => {
                                return transaction.get(db.collection('products').doc(id)).then(doc => {
                                    const currentStock = doc.data().stock;
                                        transaction.update(db.collection('products').doc(id), { stock: currentStock - 1 });
                                        let existingItem = cart.find(item => item.id === id);
                                        if (existingItem) {
                                            existingItem.quantity += 1;
                                        } else {
                                            cart.push({ 
                                                id: id, 
                                                name: product.name, 
                                                price: product.price, 
                                                quantity: 1, 
                                                credits: product.credits || 0 
                                            });
                                        }
                                        total += product.price;
                                        totalCreditsEarned += product.credits || 0;
                                        localStorage.setItem('cart', JSON.stringify(cart));
                                        updateCart();
                                });
                            });
                        }
                        });
                    });
                });
            });
        });
    }

    // Update category filter handler
    $('#category-filter').change(function() {
        customerCurrentPage = 1; // Reset to first page
        displayProducts();
    });

    // Customer: Update Cart
    function updateCart() {
        $('.cart-items').empty();
        cart.forEach(item => {
            let itemTotal = item.price * item.quantity;
            let creditsEarned = (item.credits || 0) * item.quantity;
            let $cartItem = $('<li>').addClass('list-group-item d-flex justify-content-between align-items-center');
            $cartItem.append($('<span>').text(`${item.name} (x${item.quantity}) - $${itemTotal.toFixed(2)} (Credits: ${creditsEarned})`));
            let $quantityControls = $('<div>').addClass('quantity-controls');
            let $decreaseBtn = $('<button>').text('-').addClass('btn btn-secondary btn-sm me-2 decrease-quantity')
                .click(function() { decreaseQuantity(item.id); });
            let $increaseBtn = $('<button>').text('+').addClass('btn btn-secondary btn-sm increase-quantity')
                .click(function() { increaseQuantity(item.id); });
            $quantityControls.append($decreaseBtn).append($increaseBtn);
            $cartItem.append($quantityControls);
            $('.cart-items').append($cartItem);
        });
        $('#cart-total').text(total.toFixed(2));
        $('#complete-payment').prop('disabled', cart.length === 0);

        const maxCreditsFromTotal = Math.floor(total / 1000);
        const maxCredits = Math.min(maxCreditsFromTotal, userCoins);
        $('#credits-to-use').attr('max', maxCredits);
        $('#credits-to-use').attr('min', 0);
        console.log(`Setting credits max to ${maxCredits} (total: ${maxCreditsFromTotal}, coins: ${userCoins})`);

        const currentCredits = parseInt($('#credits-to-use').val()) || 0;
        if (currentCredits > maxCredits) {
            $('#credits-to-use').val(maxCredits);
            creditsToUse = maxCredits;
            $('#credits-error').text(`Adjusted to maximum available credits: ${maxCredits}`).show();
        }
    }

    // Enforce bounds on credits input
    $('#credits-to-use').on('input', function() {
        const maxCredits = parseInt($(this).attr('max')) || 0;
        let value = parseInt($(this).val()) || 0;
        if (value < 0) {
            $(this).val(0);
            creditsToUse = 0;
            $('#credits-error').text('Credits cannot be negative').show();
        } else if (value > maxCredits) {
            $(this).val(maxCredits);
            creditsToUse = maxCredits;
            $('#credits-error').text(`Maximum available credits: ${maxCredits}`).show();
        } else {
            creditsToUse = value;
            $('#credits-error').hide();
        }
    });

    // Decrease quantity of an item in cart
    function decreaseQuantity(itemId) {
        let itemIndex = cart.findIndex(item => item.id === itemId);
        if (itemIndex !== -1) {
            db.runTransaction(transaction => {
                return transaction.get(db.collection('products').doc(itemId)).then(doc => {
                    const currentStock = doc.data().stock;
                    transaction.update(db.collection('products').doc(itemId), { stock: currentStock + 1 });
                    total -= cart[itemIndex].price;
                    totalCreditsEarned -= cart[itemIndex].credits || 0;
                    cart[itemIndex].quantity -= 1;
                    if (cart[itemIndex].quantity === 0) {
                        cart.splice(itemIndex, 1);
                    }
                    localStorage.setItem('cart', JSON.stringify(cart));
                    updateCart();
                });
            });
        }
    }

    // Increase quantity of an item in cart
    function increaseQuantity(itemId) {
        let itemIndex = cart.findIndex(item => item.id === itemId);
        if (itemIndex !== -1) {
            db.collection('products').doc(itemId).get().then(doc => {
                const product = { id: doc.id, ...doc.data() };
                if (product.stock > 0) {
                    db.runTransaction(transaction => {
                        return transaction.get(db.collection('products').doc(itemId)).then(doc => {
                            const currentStock = doc.data().stock;
                            if (currentStock > 0) {
                                transaction.update(db.collection('products').doc(itemId), { stock: currentStock - 1 });
                                total += product.price;
                                totalCreditsEarned += product.credits || 0;
                                cart[itemIndex].quantity += 1;
                                localStorage.setItem('cart', JSON.stringify(cart));
                                updateCart();
                            }
                        });
                    });
                }
            });
        }
    }

    // Handle credit application in-page
    $('#apply-credits').click(function() {
        const userId = localStorage.getItem('userId');
        const creditsInput = parseInt($('#credits-to-use').val()) || 0;
        db.collection('users').doc(userId).get().then(doc => {
            const availableCoins = doc.data().coins || 0;
            const maxCreditsFromTotal = Math.floor(total / 1000);
            const maxCredits = Math.min(maxCreditsFromTotal, availableCoins);
            if (creditsInput > availableCoins) {
                $('#credits-error').text(`Maximum available Credits: ${availableCoins}`).show();
                creditsToUse = availableCoins;
                $('#credits-to-use').val(availableCoins);
            } else if (creditsInput < 0) {
                $('#credits-error').text('Credits cannot be negative').show();
                creditsToUse = 0;
                $('#credits-to-use').val(0);
            } else if (creditsInput > maxCreditsFromTotal) {
                $('#credits-error').text(`Credits exceed total amount. Using maximum possible: ${maxCreditsFromTotal}`).show();
                creditsToUse = maxCreditsFromTotal;
                $('#credits-to-use').val(maxCreditsFromTotal);
            } else {
                $('#credits-error').hide();
                creditsToUse = creditsInput;
            }
        }).catch(error => {
            console.error("Error fetching user coins:", error.message);
            showError("Failed to fetch coin balance");
        });
    });

    // Customer: Complete Payment with Transaction and Coin Management
    $('#complete-payment').click(function() {
        if (cart.length > 0) {
            const userId = localStorage.getItem('userId');
            const creditsValue = creditsToUse * 1000;
            const remainingTotal = total - creditsValue;

            if (remainingTotal < 0) {
                $('#credits-error').text("Credits exceed total amount. Using maximum possible.").show();
                creditsToUse = Math.floor(total / 1000);
                return;
            }

            const cashPaid = Math.max(remainingTotal, 0);
            const cashProportion = total > 0 ? cashPaid / total : 0;
            const totalCredits = cart.reduce((sum, item) => sum + (item.credits || 0) * item.quantity, 0);
            const creditsEarnedFromCash = Math.floor(totalCredits * cashProportion);

            let orderId;
            db.runTransaction(transaction => {
                return Promise.all(cart.map(item => {
                    const productRef = db.collection('products').doc(item.id);
                    return transaction.get(productRef).then(doc => {
                        if (!doc.exists || doc.data().stock < 0) {
                            throw new Error(`Insufficient stock for ${doc.data().name}`);
                        }
                    });
                })).then(() => {
                    const order = { 
                        userId, 
                        items: cart, 
                        originalTotal: total,
                        remainingTotal: remainingTotal,
                        date: new Date().toISOString(), 
                        creditsUsed: creditsToUse,
                        creditsEarned: creditsEarnedFromCash
                    };
                    return db.collection('orders').add(order);
                }).then(orderRef => {
                    orderId = orderRef.id;
                    transaction.update(db.collection('users').doc(userId), {
                        coins: firebase.firestore.FieldValue.increment(-creditsToUse)
                    });
                    transaction.update(db.collection('users').doc(userId), {
                        coins: firebase.firestore.FieldValue.increment(creditsEarnedFromCash)
                    });
                });
            }).then(() => {
                $('#bill-section').removeClass('hidden');
                let $billContent = $('#bill-content').empty();
                $billContent.append($('<h3>').text('Purchase Receipt'));
                $billContent.append($('<p>').text(`Order ID: ${orderId}`).attr('data-order-id', orderId));
                $billContent.append($('<p>').text(`Date: ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`));
                let $itemsList = $('<ul>').addClass('list-group');
                cart.forEach(item => {
                    let itemTotal = item.price * item.quantity;
                    let itemCredits = (item.credits || 0) * item.quantity;
                    $itemsList.append($('<li>').addClass('list-group-item').text(`${item.name} (x${item.quantity}) - $${itemTotal.toFixed(2)} (Credits: ${itemCredits})`));
                });
                $billContent.append($itemsList);
                $billContent.append($('<p>').addClass('fw-bold').text(`Subtotal: $${total.toFixed(2)}`));
                $billContent.append($('<p>').text(`Credits Used: ${creditsToUse} ($${creditsValue.toFixed(2)})`));
                $billContent.append($('<p>').text(`Net Credits Received: ${creditsEarnedFromCash}`));
                $billContent.append($('<p>').text(`Remaining Paid: $${remainingTotal.toFixed(2)}`));
                $billContent.append($('<p>').addClass('fw-bold').text(`Total: $${remainingTotal.toFixed(2)}`));
                $billContent.append($('<p>').addClass('text-muted small').text(
                    `Note: Net Credits Received are calculated as the total potential credits (${totalCredits}) multiplied by the proportion of the payment made with cash (${(cashProportion * 100).toFixed(1)}% of the total amount), then rounded down to the nearest whole number.`
                ).data('totalCredits', totalCredits).data('cashProportion', cashProportion));

                cart = [];
                total = 0;
                totalCreditsEarned = 0;
                creditsToUse = 0;
                $('#credits-to-use').val(0);
                localStorage.setItem('cart', JSON.stringify(cart));
                updateCart();
                displayOrderHistory();
                db.collection('users').doc(userId).get().then(doc => {
                    userCoins = doc.data().coins;
                    updateCoinBalance(userCoins);
                });
                showAlert('Payment completed successfully');
            }).catch(error => {
                console.error("Transaction failed:", error.message);
                showError(error.message);
            });
        }
    });

    // Customer: Download Bill
    $('#download-bill').click(function() {
        if ($('#bill-content').length === 0) {
            console.error("Bill content not found");
            showError("Bill content is not available.");
            return;
        }

        let billText = "Purchase Receipt\n";
        const orderId = $('#bill-content p[data-order-id]').attr('data-order-id');
        billText += `Order ID: ${orderId}\n`;
        billText += `Date: ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}\n\n`;
        $('#bill-content .list-group-item').each(function() {
            billText += `${$(this).text()}\n`;
        });
        billText += `\nSubtotal: $${$('#bill-content p:contains("Subtotal")').text().split('$')[1] || '0.00'}\n`;
        const creditsUsed = parseInt($('#bill-content p:contains("Credits Used")').text().match(/\d+/) || 0);
        const creditsEarned = parseInt($('#bill-content p:contains("Net Credits Received")').text().match(/\d+/) || 0);
        billText += `Credits Used: ${creditsUsed} ($${creditsUsed * 1000})\n`;
        billText += `Net Credits Received: ${creditsEarned}\n`;
        billText += `Remaining Paid: $${$('#bill-content p:contains("Remaining Paid")').text().split('$')[1] || '0.00'}\n`;
        billText += `Total: $${$('#bill-content p:contains("Total")').text().split('$')[1] || '0.00'}`;

        let blob = new Blob([billText], { type: 'text/plain;charset=utf-8' });
        let url = window.URL || window.webkitURL;
        let link = url.createObjectURL(blob);
        let a = document.createElement('a');
        a.href = link;
        a.download = 'bill.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        url.revokeObjectURL(link);
    });

    // Customer: Print Bill as PDF using jsPDF
    $('#print-bill').click(function() {
        if ($('#bill-content').length === 0) {
            console.error("Bill content not found");
            showError("Bill content is not available.");
            return;
        }

        const orderId = $('#bill-content p[data-order-id]').attr('data-order-id');
        const dateText = $('#bill-content p:contains("Date")').text().replace('Date: ', '');
        const $itemsList = $('#bill-content .list-group');
        const originalTotal = parseFloat($('#bill-content p:contains("Subtotal")').text().split('$')[1]) || 0;
        const remainingPaid = parseFloat($('#bill-content p:contains("Remaining Paid")').text().split('$')[1]) || 0;
        const creditsUsed = parseInt($('#bill-content p:contains("Credits Used")').text().match(/\d+/) || 0);
        const creditsEarned = parseInt($('#bill-content p:contains("Net Credits Received")').text().match(/\d+/) || 0);

        const $note = $('#bill-content p.text-muted.small');
        const totalCredits = $note.data('totalCredits');
        const cashProportion = $note.data('cashProportion');

        generatePDF(orderId, dateText, $itemsList, originalTotal, remainingPaid, creditsUsed, creditsEarned, totalCredits, cashProportion, true)
            .catch(error => {
                console.error("PDF generation failed:", error.message);
                showError("Failed to generate PDF. Check console for details.");
            });
    });

    // Customer: Display Order History
    function displayOrderHistory() {
        const userId = localStorage.getItem('userId');
        console.log("Querying orders for userId:", userId); // Added logging
        $('#order-history').empty();
        db.collection('orders').where('userId', '==', userId).orderBy('date', 'desc').get()
            .then(snapshot => {
                snapshot.forEach(doc => {
                    const order = doc.data();
                    let $orderCard = $('<div>').addClass('order-card col-md-4');
                    $orderCard.append($('<h5>').text(`Order on ${new Date(order.date).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`));
                    $orderCard.append($('<p>').text(`Order ID: ${doc.id}`));
                    let $itemsList = $('<ul>').addClass('list-group');
                    order.items.forEach(item => {
                        let itemTotal = item.price * item.quantity;
                        let creditsEarned = (item.credits || 0) * item.quantity;
                        $itemsList.append($('<li>').addClass('list-group-item').text(`${item.name} (x${item.quantity}) - $${itemTotal.toFixed(2)} (Credits: ${creditsEarned})`));
                    });
                    $orderCard.append($itemsList);
                    $orderCard.append($('<p>').addClass('fw-bold').text(`Subtotal: $${order.originalTotal.toFixed(2)}`));
                    $orderCard.append($('<p>').text(`Credits Used: ${order.creditsUsed || 0} ($${(order.creditsUsed * 1000).toFixed(2)})`));
                    $orderCard.append($('<p>').text(`Credits Earned: ${order.creditsEarned || 0}`));
                    $orderCard.append($('<p>').text(`Remaining Paid: $${order.remainingTotal.toFixed(2)}`));
                    $orderCard.append($('<p>').addClass('fw-bold').text(`Total: $${order.remainingTotal.toFixed(2)}`));
                    $('#order-history').append($orderCard);
                });
            })
            .catch(error => {
                console.error("Error fetching order history:", error.message);
                showError("Failed to load order history");
            });
    }

    // Admin: Display Products for Editing
    function displayAdminProducts() {
            $('.admin-products').empty();
        
            db.collection('products').onSnapshot(snapshot => {
                $('.admin-products').empty();
            
            // Get all products first
            let allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Calculate pagination
            const totalPages = Math.ceil(allProducts.length / itemsPerPage);
            adminCurrentPage = Math.min(Math.max(1, adminCurrentPage), totalPages || 1);
            
            // Get current page's products
            const startIndex = (adminCurrentPage - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;
            const currentPageProducts = allProducts.slice(startIndex, endIndex);
            
            // Display products (keeping your existing display logic)
            currentPageProducts.forEach(product => {
                    let $product = $('<div>').addClass('admin-product col-md-4').attr('data-id', product.id);
                
                // Keep your existing product display code
                $product.append($('<input>').attr({
                    type: 'text',
                    value: product.name,
                    placeholder: 'Product Name'
                }).addClass('form-control product-name'));
                
                $product.append($('<input>').attr({
                    type: 'number',
                    value: product.price,
                    placeholder: 'Price'
                }).addClass('form-control product-price'));
                
                $product.append($('<input>').attr({
                    type: 'number',
                    value: product.stock,
                    placeholder: 'Stock'
                }).addClass('form-control product-stock'));
                
                $product.append($('<input>').attr({
                    type: 'number',
                    value: product.credits || 0,
                    placeholder: 'Credits'
                }).addClass('form-control product-credits'));
                
                let $deleteBtn = $('<button>').text('Delete').addClass('btn btn-danger delete-product');
                let $saveBtn = $('<button>').text('Save').addClass('btn btn-primary save-product');
                
                // Create button container
                let $buttonContainer = $('<div>').addClass('button-container');
                $buttonContainer.append($deleteBtn, $saveBtn);
                
                $product.append($buttonContainer);

                    if (product.assetId) {
                        db.collection('assets').doc(product.assetId).get().then(assetDoc => {
                        if (assetDoc.exists) {
                            const asset = assetDoc.data();
                            if (asset.url) {
                                $product.prepend($('<img>').attr('src', asset.url).addClass('img-fluid mb-2'));
                            }
                            }
                        });
                    }

                $('.admin-products').append($product);
            });

            // Add pagination controls
            $('.admin-pagination-controls').remove();
            const $paginationControls = $('<div>').addClass('admin-pagination-controls text-center mt-3');
            const $prevBtn = $('<button>').text('« Previous').addClass('btn btn-secondary mx-2');
            const $nextBtn = $('<button>').text('Next »').addClass('btn btn-secondary mx-2');
            const $pageInfo = $('<span>').text(`Page ${adminCurrentPage} of ${totalPages}`).addClass('mx-2');
            
            $prevBtn.prop('disabled', adminCurrentPage === 1);
            $nextBtn.prop('disabled', adminCurrentPage === totalPages);
            
            $prevBtn.click(() => {
                if (adminCurrentPage > 1) {
                    adminCurrentPage--;
                    displayAdminProducts();
                }
            });
            
            $nextBtn.click(() => {
                if (adminCurrentPage < totalPages) {
                    adminCurrentPage++;
                    displayAdminProducts();
                }
            });
            
            $paginationControls.append($prevBtn, $pageInfo, $nextBtn);
            $('.admin-products').after($paginationControls);
        });
    }

    // Admin: Add New Product with File Upload and Base64 Conversion
    $('#add-product-form').submit(function(e) {
        e.preventDefault();
        checkAdmin().then(isAdmin => {
            if (!isAdmin) {
                showError('Access denied: Admin only.');
                return;
            }
            const fileInput = $('#new-asset-file')[0];
            let newProduct = {
                name: $('#new-name').val(),
                price: parseFloat($('#new-price').val()),
                stock: parseInt($('#new-stock').val()),
                credits: parseInt($('#new-credits').val()) || 0,
                categoryId: $('#new-category').val() || null,
                assetId: null
            };

            if (fileInput.files && fileInput.files[0]) {
                const file = fileInput.files[0];
                fileToBase64(file)
                    .then(base64String => {
                        if (!base64String.startsWith('data:image/')) {
                            throw new Error('Uploaded file is not a valid image');
                        }
                        return db.collection('assets').add({
                            url: base64String,
                            createdAt: new Date().toISOString(),
                            createdBy: localStorage.getItem('userId')
                        });
                    })
                    .then(assetRef => {
                        newProduct.assetId = assetRef.id;
                        return db.collection('products').add(newProduct);
                    })
                    .then(() => {
                        showAlert('Product added with image');
                        this.reset();
                    })
                    .catch(error => {
                        console.error("Error adding product with image:", error.message);
                        showError(error.message);
                    });
            } else {
                db.collection('products').add(newProduct)
                    .then(() => {
                        showAlert('Product added');
                        this.reset();
                    })
                    .catch(error => {
                        console.error("Error adding product:", error.message);
                        showError(error.message);
                    });
            }
        });
    });

    // Utility: Check Admin Role
    function checkAdmin() {
        const userId = localStorage.getItem('userId');
        return db.collection('users').doc(userId).get().then(doc => doc.exists && doc.data().role === 'admin');
    }

    // Utility: Show Alert
    function showAlert(message) {
        let $alert = $('<div>').addClass('alert alert-success').text(message);
        $('body').append($alert);
        $alert.fadeIn(300).delay(2000).fadeOut(300, function() { $(this).remove(); });
    }

    // Utility: Show Error with Retry
    function showError(message) {
        console.log("Opening error modal with message:", message);
        $('#error-message').text(message);
        const $modal = $('#error-modal');
        $modal.modal('show');
        
        // Monitor modal state
        $modal.on('shown.bs.modal', function() {
            console.log("Modal opened successfully");
        });

        // Monitor close attempts
        $('.modal-close, [data-dismiss="modal"]').on('click', function() {
            console.log("Modal close button clicked");
            $modal.modal('hide');
        });

        // Monitor retry button
        $('#retry-btn').off('click').on('click', function() {
            console.log("Retry button clicked");
            $modal.modal('hide');
            $('#google-login-btn').click();
        });

        // Monitor modal hide
        $modal.on('hidden.bs.modal', function() {
            console.log("Modal closed successfully");
        });
    }

    // Add this to your document ready function
    document.querySelectorAll('[data-bs-dismiss="modal"]').forEach(button => {
        button.addEventListener('click', () => {
            const modal = button.closest('.modal');
            modal.classList.remove('show');
        });
    });

    // Add category filter change handler
    $('#category-filter').change(function() {
        displayProducts();
    });

    // Add loadCategories to your document.ready
    function loadCategories() {
        console.log("Starting to load categories...");
        
        return db.collection('categories').get().then(snapshot => {
            console.log("Categories snapshot received:", snapshot.size, "documents");
            
            if (snapshot.empty) {
                console.warn("No categories found in database");
                return;
            }

            const categories = snapshot.docs.map(doc => {
                const data = doc.data();
                console.log("Loading category:", doc.id, data);
                return {
                    id: doc.id,
                    name: data.name
                };
            });

            // Verify categories were loaded
            console.log("Loaded categories:", categories);

            // Update both dropdowns if they exist
            const $newCategory = $('#new-category');
            const $categoryFilter = $('#category-filter');

            if ($newCategory.length) {
                console.log("Updating admin dropdown");
                $newCategory.find('option:not(:first)').remove();
                categories.forEach(category => {
                    $newCategory.append($('<option>')
                        .val(category.id)
                        .text(category.name));
                });
            } else {
                console.warn("Admin category dropdown not found");
            }

            if ($categoryFilter.length) {
                console.log("Updating customer dropdown");
                $categoryFilter.find('option:not(:first)').remove();
                categories.forEach(category => {
                    $categoryFilter.append($('<option>')
                        .val(category.id)
                        .text(category.name));
                });
            } else {
                console.warn("Customer category dropdown not found");
            }

        }).catch(error => {
            console.error("Error loading categories:", error);
        });
    }

    // Initial cart update
    updateCart();
    loadCategories(); // Add this line

    // Add modal diagnostic check
    if ($('#error-modal').length) {
        console.log("Error modal element found in DOM");
    } else {
        console.warn("Error modal element not found in DOM");
    }

    // Check modal close buttons
    if ($('[data-dismiss="modal"]').length) {
        console.log("Modal close buttons found:", $('[data-dismiss="modal"]').length);
    } else {
        console.warn("No modal close buttons found");
    }

    // Add this at the start of your auth handling
    const originalConsoleError = console.error;
    console.error = function(msg, ...args) {
        if (msg?.includes?.('Cross-Origin-Opener-Policy')) {
            console.warn('Auth Window Notice:', msg);
            return;
        }
        originalConsoleError.apply(this, [msg, ...args]);
    };

    // Add at the start of your script
    window.addEventListener('unhandledrejection', function(event) {
        if (event.reason?.message?.includes('Cross-Origin-Opener-Policy')) {
            console.warn('Auth Window Notice:', event.reason.message);
            event.preventDefault(); // Prevent error from appearing in console
        }
    });

    // Reports button click handler
    $('#view-reports').click(function() {
        $('#reportsModal').modal('show');
        loadAllReports();
    });

    // Tab change handler
    $('.nav-link').on('shown.bs.tab', function(e) {
        const targetId = $(e.target).attr('href');
        loadReportData(targetId.substring(1));
    });

    // Download PDF handler
    $('.download-pdf').click(function() {
        const reportType = $(this).data('report');
        generatePDF(reportType);
    });

   

    function initializeReports() {
        // Handle tab switching
        $('.nav-tabs a').on('click', function(e) {
            e.preventDefault();
            $(this).tab('show');
        });

        // Handle tab content loading
        $('.nav-tabs a').on('shown.bs.tab', function(e) {
            const target = $(e.target).attr('href');
            switch(target) {
                case '#top10orders':
                    loadTop10Orders();
                    break;
                case '#top10products':
                    loadTop10Products();
                    break;
                case '#top10customers':
                    loadTop10Customers();
                    break;
            }
        });
    }

    // Add this helper function for CSV download
    function downloadCSV(data, filename) {
        const csvHeader = Object.keys(data[0]).join(',');
        const csvRows = data.map(row => 
            Object.values(row).map(value => 
                typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value
            ).join(',')
        );
        
        const csvContent = [csvHeader, ...csvRows].join('\\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (navigator.msSaveBlob) {
            navigator.msSaveBlob(blob, filename);
        } else {
            link.href = URL.createObjectURL(blob);
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    function loadTop10Orders() {
        const $content = $('#top10orders .report-content');
        $content.html('<div class="spinner-border" role="status"></div>');

        db.collection('orders')
            .orderBy('originalTotal', 'desc')
            .limit(10)
            .get()
            .then(snapshot => {
                if (snapshot.empty) {
                    $content.html('<p>No orders found</p>');
                    return;
                }

                const orders = snapshot.docs.map(doc => {
                    const order = doc.data();
                    return {
                        'Order ID': doc.id,
                        'Customer ID': order.userId,
                        'Total Value': `$${order.originalTotal.toFixed(2)}`,
                        'Date': new Date(order.date).toLocaleDateString()
                    };
                });

                const tableRows = orders.map(order => `
                    <tr>
                        <td>${order['Order ID']}</td>
                        <td>${order['Customer ID']}</td>
                        <td>${order['Total Value']}</td>
                        <td>${order['Date']}</td>
                    </tr>
                `).join('');

                const downloadBtn = `
                    <div class="text-end mb-3">
                        <button class="btn btn-success download-csv">
                            <i class="fas fa-download"></i> Download CSV
                        </button>
                    </div>
                `;

                $content.html(`
                    ${downloadBtn}
                    <table class="table table-striped">
                        <thead>
                            <tr>
                                <th>Order ID</th>
                                <th>Customer</th>
                                <th>Total Value</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                `);

                $content.find('.download-csv').on('click', () => {
                    downloadCSV(orders, 'top_orders_report.csv');
                });
            })
            .catch(error => {
                console.error('Error loading orders:', error);
                $content.html('<p class="text-danger">Error loading orders</p>');
            });
    }

    function loadTop10Products() {
        const $content = $('#top10products .report-content');
        $content.html('<div class="spinner-border" role="status"></div>');

        db.collection('orders').get()
            .then(snapshot => {
                const productStats = {};
                
                // Process orders and accumulate stats
                snapshot.docs.forEach(doc => {
                    const order = doc.data();
                    if (order && order.items && Array.isArray(order.items)) {
                        order.items.forEach(item => {
                            if (item && item.productId) {
                                if (!productStats[item.productId]) {
                                    productStats[item.productId] = {
                                        quantity: 0,
                                        revenue: 0
                                    };
                                }
                                productStats[item.productId].quantity += item.quantity || 0;
                                productStats[item.productId].revenue += (item.price || 0) * (item.quantity || 0);
                            }
                        });
                    }
                });

                // Get top 10 products
                const topProducts = Object.entries(productStats)
                    .sort(([, a], [, b]) => b.quantity - a.quantity)
                    .slice(0, 10);

                // Fetch product details
                return Promise.all(
                    topProducts.map(([productId]) => 
                        db.collection('products').doc(productId).get()
                            .then(doc => {
                                if (!doc.exists) {
                                    return {
                                        id: productId,
                                        data: { name: 'Product Not Found', stock: 0 },
                                        stats: productStats[productId]
                                    };
                                }
                                return {
                                    id: doc.id,
                                    data: doc.data(),
                                    stats: productStats[doc.id]
                                };
                            })
                            .catch(error => ({
                                id: productId,
                                data: { name: 'Error Loading Product', stock: 0 },
                                stats: productStats[productId]
                            }))
                    )
                );
            })
            .then(products => {
                if (!products || products.length === 0) {
                    $content.html('<p>No product data available</p>');
                    return;
                }

                const formattedProducts = products.map(product => ({
                    'Product Name': product.data?.name || 'N/A',
                    'Units Sold': product.stats?.quantity || 0,
                    'Total Revenue': `$${(product.stats?.revenue || 0).toFixed(2)}`,
                    'Current Stock': product.data?.stock || 0
                }));

                const tableRows = formattedProducts.map(product => `
                    <tr>
                        <td>${product['Product Name']}</td>
                        <td>${product['Units Sold']}</td>
                        <td>${product['Total Revenue']}</td>
                        <td>${product['Current Stock']}</td>
                    </tr>
                `).join('');

                const downloadBtn = `
                    <div class="text-end mb-3">
                        <button class="btn btn-success download-csv">
                            <i class="fas fa-download"></i> Download CSV
                        </button>
                    </div>
                `;

                $content.html(`
                    ${downloadBtn}
                    <table class="table table-striped">
                        <thead>
                            <tr>
                                <th>Product Name</th>
                                <th>Units Sold</th>
                                <th>Total Revenue</th>
                                <th>Current Stock</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                `);

                $content.find('.download-csv').on('click', () => {
                    downloadCSV(formattedProducts, 'top_products_report.csv');
                });
            })
            .catch(error => {
                console.error('Error loading products:', error);
                $content.html('<p class="text-danger">Error loading product data</p>');
            });
    }

    function loadTop10Customers() {
        const $content = $('#top10customers .report-content');
        $content.html('<div class="spinner-border" role="status"></div>');

        db.collection('orders').get()
            .then(snapshot => {
                const customerStats = {};
                
                // Aggregate customer data
                snapshot.docs.forEach(doc => {
                    const order = doc.data();
                    if (!customerStats[order.userId]) {
                        customerStats[order.userId] = {
                            orderCount: 0,
                            totalSpent: 0
                        };
                    }
                    customerStats[order.userId].orderCount++;
                    customerStats[order.userId].totalSpent += order.originalTotal;
                });

                // Get top 10 customers by order count
                const topCustomers = Object.entries(customerStats)
                    .sort(([, a], [, b]) => b.orderCount - a.orderCount)
                    .slice(0, 10);

                // Get customer details
                return Promise.all(
                    topCustomers.map(([userId]) => 
                        db.collection('users').doc(userId).get()
                            .then(doc => ({
                                id: doc.id,
                                data: doc.data(),
                                stats: customerStats[doc.id]
                            }))
                        )
                )
            })
            .then(customers => {
                if (!customers || customers.length === 0) {
                    $content.html('<p>No customer data available</p>');
                    return;
                }

                const formattedCustomers = customers.map(customer => ({
                    'Customer ID': customer.id,
                    'Orders Count': customer.stats.orderCount,
                    'Total Spent': `$${customer.stats.totalSpent.toFixed(2)}`,
                    'Current Credits': customer.data.coins || 0
                }));

                const tableRows = formattedCustomers.map(customer => `
                    <tr>
                        <td>${customer['Customer ID']}</td>
                        <td>${customer['Orders Count']}</td>
                        <td>${customer['Total Spent']}</td>
                        <td>${customer['Current Credits']}</td>
                    </tr>
                `).join('');

                const downloadBtn = `
                    <div class="text-end mb-3">
                        <button class="btn btn-success download-csv">
                            <i class="fas fa-download"></i> Download CSV
                        </button>
                    </div>
                `;

                $content.html(`
                    ${downloadBtn}
                    <table class="table table-striped">
                        <thead>
                            <tr>
                                <th>Customer ID</th>
                                <th>Orders Count</th>
                                <th>Total Spent</th>
                                <th>Current Credits</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                `);

                $content.find('.download-csv').on('click', () => {
                    downloadCSV(formattedCustomers, 'top_customer_report.csv');
                });
            })
            .catch(error => {
                console.error('Error loading customers:', error);
                $content.html('<p class="text-danger">Error loading customer data</p>');
            });
    }

    function loadAllReports() {
        try {
            loadTop10Orders();
            loadTop10Products();
            loadTop10Customers();
            loadOrdersReport();
            loadProductsReport();
            loadCustomersReport();
        } catch (error) {
            console.error('Error loading reports:', error);
        }
    }

    function loadOrdersReport() {
        // Implementation of loadOrdersReport function
    }

    function loadProductsReport() {
        // Implementation of loadProductsReport function
    }

    function loadCustomersReport() {
        // Implementation of loadCustomersReport function
    }
});



