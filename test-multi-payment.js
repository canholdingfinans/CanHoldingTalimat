// Test script to verify multi-payment functionality
console.log('=== Multi-Payment Test Script ===');

// Function to simulate adding multiple payments
function testMultiPayment() {
    console.log('Testing multi-payment functionality...');
    
    // Check if the main container exists
    const container = document.getElementById('cokluOdemeAlanlari');
    if (!container) {
        console.error('Multi-payment container not found!');
        return false;
    }
    
    // Check initial state
    const initialPayments = container.querySelectorAll('.payment-container');
    console.log('Initial payment containers:', initialPayments.length);
    
    // Try to add a payment
    const addButton = document.getElementById('yeniOdemeEkleBtn');
    if (addButton) {
        console.log('Clicking original "Yeni Ödeme Ekle" button');
        addButton.click();
        
        // Wait a bit and check if payment was added
        setTimeout(() => {
            const paymentsAfterFirstClick = container.querySelectorAll('.payment-container');
            console.log('Payment containers after first click:', paymentsAfterFirstClick.length);
            
            if (paymentsAfterFirstClick.length > initialPayments.length) {
                console.log('✓ First payment added successfully');
                
                // Try to click the dynamic button
                const dynamicButton = document.querySelector('.yeniOdemeEkleBtnDynamic');
                if (dynamicButton) {
                    console.log('Clicking dynamic "Yeni Ödeme Ekle" button');
                    dynamicButton.click();
                    
                    // Wait a bit and check if second payment was added
                    setTimeout(() => {
                        const paymentsAfterSecondClick = container.querySelectorAll('.payment-container');
                        console.log('Payment containers after second click:', paymentsAfterSecondClick.length);
                        
                        if (paymentsAfterSecondClick.length > paymentsAfterFirstClick.length) {
                            console.log('✓ Second payment added successfully');
                            console.log('✓ Multi-payment functionality is working correctly!');
                            return true;
                        } else {
                            console.error('✗ Second payment was not added');
                            return false;
                        }
                    }, 100);
                } else {
                    console.error('✗ Dynamic button not found');
                    return false;
                }
            } else {
                console.error('✗ First payment was not added');
                return false;
            }
        }, 100);
    } else {
        console.error('Original "Yeni Ödeme Ekle" button not found!');
        return false;
    }
}

// Run the test when the page is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', testMultiPayment);
} else {
    testMultiPayment();
}