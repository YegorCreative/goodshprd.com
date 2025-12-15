/**
 * Find the Sheep — Interactive Game Module
 * Lightweight, mobile-first interaction
 */

// Game Configuration (easily swappable for new photos)
const gamePhotos = [
    {
        id: 1,
        image: 'img/shepherd-icon.png',
        sheepX: '42%',
        sheepY: '48%',
        sheepSize: '80px',
        location: 'Mountains of Patagonia, Argentina',
        options: [
            'Patagonia, Argentina',
            'Swiss Alps, Switzerland',
            'Lake District, England',
            'Fjords of Norway'
        ]
    },
    // Add more photos here with different sheep positions
    // {
    //     id: 2,
    //     image: 'img/photo2.jpg',
    //     sheepX: '65%',
    //     sheepY: '40%',
    //     sheepSize: '60px',
    //     location: 'Scottish Highlands, Scotland',
    //     options: [...]
    // }
];

let currentGame = null;
let currentPhotoIndex = 0;
let isGameComplete = false;

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    const beginBtn = document.getElementById('beginBtn');
    const findAnotherBtn = document.getElementById('findAnotherBtn');
    const exploreBtn = document.getElementById('exploreBtn');
    
    if (beginBtn) {
        beginBtn.addEventListener('click', startGame);
    }
    if (findAnotherBtn) {
        findAnotherBtn.addEventListener('click', nextPhoto);
    }
    if (exploreBtn) {
        exploreBtn.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }
});

// Start the game
function startGame() {
    showState('photoState');
    loadPhoto(0);
}

// Load a photo and set up interaction
function loadPhoto(index) {
    const photo = gamePhotos[index];
    currentPhotoIndex = index;
    isGameComplete = false;
    currentGame = photo;
    
    const img = document.getElementById('gamePhoto');
    const sheepTarget = document.getElementById('sheepTarget');
    
    img.src = photo.image;
    img.onload = function() {
        setupSheepTarget(sheepTarget, photo);
    };
}

// Position the sheep target zone
function setupSheepTarget(element, photo) {
    element.style.left = photo.sheepX;
    element.style.top = photo.sheepY;
    element.style.width = photo.sheepSize;
    element.style.height = photo.sheepSize;
    
    // Add click handler for the target area
    element.addEventListener('click', onSheepFound);
    
    // Prevent clicks outside target (silent fail)
    document.getElementById('gamePhoto').addEventListener('click', function(e) {
        if (e.target === this) {
            // Click was on image, not on sheep target
            return;
        }
    });
}

// When sheep is found
function onSheepFound(e) {
    if (isGameComplete) return;
    
    isGameComplete = true;
    
    // Reveal sheep
    const sheepOverlay = document.getElementById('sheepOverlay');
    sheepOverlay.classList.remove('hidden');
    
    // Show found state
    setTimeout(() => {
        showState('foundState');
        setupLocationOptions(currentGame);
    }, 300);
}

// Set up location guessing buttons
function setupLocationOptions(photo) {
    const container = document.getElementById('locationOptions');
    container.innerHTML = '';
    
    // Shuffle options (keep correct answer among them)
    const shuffled = [...photo.options].sort(() => Math.random() - 0.5);
    
    shuffled.forEach((option, index) => {
        const button = document.createElement('button');
        button.className = 'btn btn-location';
        button.textContent = option;
        button.addEventListener('click', () => revealLocation(photo));
        container.appendChild(button);
    });
}

// Reveal the actual location
function revealLocation(photo) {
    document.getElementById('locationReveal').textContent = 'This photo was taken in ' + photo.location;
    showState('revealState');
}

// Load next photo
function nextPhoto() {
    currentPhotoIndex = (currentPhotoIndex + 1) % gamePhotos.length;
    showState('photoState');
    
    // Reset sheep overlay
    document.getElementById('sheepOverlay').classList.add('hidden');
    
    loadPhoto(currentPhotoIndex);
}

// Utility: Show/hide game states
function showState(stateId) {
    document.querySelectorAll('.game-state').forEach(state => {
        state.classList.add('hidden');
    });
    document.getElementById(stateId).classList.remove('hidden');
}
