const nycBoard = [
    { id: 0, name: "START", type: "start", price: 0, rent: [], color: null },
    { id: 1, name: "Staten Island", type: "property", price: 60, rent: [2, 10, 30, 90, 160, 250], color: "brown" },
    { id: 2, name: "Community Chest", type: "community_chest", price: 0, rent: [], color: null },
    { id: 3, name: "Bronx", type: "property", price: 60, rent: [4, 20, 60, 180, 320, 450], color: "brown" },
    { id: 4, name: "City Tax", type: "tax", price: 200, rent: [], color: null },
    { id: 5, name: "Penn Station", type: "railroad", price: 200, rent: [25, 50, 100, 200], color: null },
    { id: 6, name: "Queens", type: "property", price: 100, rent: [6, 30, 90, 270, 400, 550], color: "lightblue" },
    { id: 7, name: "Chance", type: "chance", price: 0, rent: [], color: null },
    { id: 8, name: "Brooklyn", type: "property", price: 100, rent: [6, 30, 90, 270, 400, 550], color: "lightblue" },
    { id: 9, name: "Coney Island", type: "property", price: 120, rent: [8, 40, 100, 300, 450, 600], color: "lightblue" },
    
    { id: 10, name: "PRISON", type: "jail", price: 0, rent: [], color: null },
    { id: 11, name: "Harlem", type: "property", price: 140, rent: [10, 50, 150, 450, 625, 750], color: "pink" },
    { id: 12, name: "Con Edison", type: "utility", price: 150, rent: [], color: null },
    { id: 13, name: "Greenwich Village", type: "property", price: 140, rent: [10, 50, 150, 450, 625, 750], color: "pink" },
    { id: 14, name: "Chelsea", type: "property", price: 160, rent: [12, 60, 180, 500, 700, 900], color: "pink" },
    { id: 15, name: "Grand Central", type: "railroad", price: 200, rent: [25, 50, 100, 200], color: null },
    { id: 16, name: "SoHo", type: "property", price: 180, rent: [14, 70, 200, 550, 750, 950], color: "orange" },
    { id: 17, name: "Community Chest", type: "community_chest", price: 0, rent: [], color: null },
    { id: 18, name: "Tribeca", type: "property", price: 180, rent: [14, 70, 200, 550, 750, 950], color: "orange" },
    { id: 19, name: "Wall Street", type: "property", price: 200, rent: [16, 80, 220, 600, 800, 1000], color: "orange" },

    { id: 20, name: "Tax Heaven", type: "tax_heaven", price: 0, rent: [], color: null },
    { id: 21, name: "Times Square", type: "property", price: 220, rent: [18, 90, 250, 700, 875, 1050], color: "red" },
    { id: 22, name: "Chance", type: "chance", price: 0, rent: [], color: null },
    { id: 23, name: "Broadway", type: "property", price: 220, rent: [18, 90, 250, 700, 875, 1050], color: "red" },
    { id: 24, name: "Central Park", type: "property", price: 240, rent: [20, 100, 300, 750, 925, 1100], color: "red" },
    { id: 25, name: "JFK Airport", type: "railroad", price: 200, rent: [25, 50, 100, 200], color: null },
    { id: 26, name: "Madison Square", type: "property", price: 260, rent: [22, 110, 330, 800, 975, 1150], color: "yellow" },
    { id: 27, name: "Empire State", type: "property", price: 260, rent: [22, 110, 330, 800, 975, 1150], color: "yellow" },
    { id: 28, name: "Water Works", type: "utility", price: 150, rent: [], color: null },
    { id: 29, name: "Chrysler Bldg", type: "property", price: 280, rent: [24, 120, 360, 850, 1025, 1200], color: "yellow" },

    { id: 30, name: "GO TO PRISON", type: "go_to_jail", price: 0, rent: [], color: null },
    { id: 31, name: "Fifth Avenue", type: "property", price: 300, rent: [26, 130, 390, 900, 1100, 1275], color: "green" },
    { id: 32, name: "Park Avenue", type: "property", price: 300, rent: [26, 130, 390, 900, 1100, 1275], color: "green" },
    { id: 33, name: "Community Chest", type: "community_chest", price: 0, rent: [], color: null },
    { id: 34, name: "Madison Ave", type: "property", price: 320, rent: [28, 150, 450, 1000, 1200, 1400], color: "green" },
    { id: 35, name: "LaGuardia", type: "railroad", price: 200, rent: [25, 50, 100, 200], color: null },
    { id: 36, name: "Chance", type: "chance", price: 0, rent: [], color: null },
    { id: 37, name: "Brooklyn Bridge", type: "property", price: 350, rent: [35, 175, 500, 1100, 1300, 1500], color: "darkblue" },
    { id: 38, name: "Luxury Tax", type: "tax", price: 75, rent: [], color: null },
    { id: 39, name: "Statue of Liberty", type: "property", price: 400, rent: [50, 200, 600, 1400, 1700, 2000], color: "darkblue" }
];

if (typeof module !== 'undefined') {
    module.exports = nycBoard;
}
