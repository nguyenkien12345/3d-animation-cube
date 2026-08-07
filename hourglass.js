(function () {
    const canvas = document.getElementById('hourglassCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const wrapper = document.getElementById('hourglassWrapper');

    const imageSources = [
        'Thuy12.jpg',
        'Thuy35.jpg',
        'Thuy17.jpg',
        'Thuy24.jpg',
        'Thuy7.jpg',
        'Thuy8.jpg',
        'Thuy16.jpg',
        'Thuy20.jpg'
    ];
    let currentImgIdx = 0;

    // Kích thước canvas (Hiện tại bằng với width và height của hourglass-wrapper)
    const W = 300;
    const H = 500;
    canvas.width = W;
    canvas.height = H;

    // Thông số đồng hồ cát
    const CX = W / 2;       // 150 (Đường trục tung (trục dọc) chính giữa đồng hồ). Mọi phép tính bề rộng đều tính từ trục này sang trái/phải.
    const NECK_Y = H / 2;   // 250 (Điểm thắt hẹp ở trung tâm đồng hồ cát). Tâm của cổ đồng hồ (y = 250). Đây là vị trí hẹp nhất của đồng hồ cát
    const NECK_W = 14;      // Bán kính của cổ đồng hồ (14 px). Tức là từ CX sang thành kính chỉ có 14 px tại vị trí cổ

    const TOP_BULB_MIN_Y = 35; // Mép trên của phần thủy tinh. Đây là nơi bắt đầu tính hình dạng của bầu trên
    const TOP_BULB_MAX_Y = 225; // Đáy của bầu trên
    // => Giới hạn không gian chứa cát ở bầu trên (35 -> 225)

    const BOTTOM_BULB_MIN_Y = 248; // Điểm bắt đầu của bầu dưới, gần như sát NECK_Y
    const BOTTOM_BULB_MAX_Y = 470; // Đáy của bầu dưới
    // => Giới hạn không gian hiển thị ảnh và cát ở bầu dưới (248 ➔ 470)

    // Kích thước ảnh HD phủ vừa khít bầu dưới (ôm sát viền kính)
    // Kích thước chữ nhật chuẩn của bức ảnh hiển thị trong bầu dưới
    const targetW = 194;
    const targetH = 222;
    const startX = CX - targetW / 2; // 53
    const startY = 248;

    // - LOADING: Tải ảnh lên và vẽ sẵn lên Canvas
    // - FILLING: Cát bắt đầu rơi từ bầu trên xuống bầu dưới; Mặt ảnh dâng lên từ từ theo mực cát
    // - HOLD: Ảnh đã dâng ngập 100% bầu dưới. Tạm dừng để người xem thưởng thức ảnh. Chạy hiệu ứng tia sáng lướt qua
    // - FLIPPING: Kích hoạt animation xoay CSS 180° toàn bộ khối đồng hồ cát. Sau đó nạp ảnh kế tiếp
    let state = 'LOADING'; // 'LOADING', 'FILLING', 'HOLD', 'FLIPPING'
    let stateTimer = 0;

    // Góc xoay tích lũy của đồng hồ
    let currentAngle = 0;

    let shineProgress = -1;

    // Lưu trữ thẻ Canvas ẩn chứa ảnh
    let hdCanvas = null;

    // Mảng lưu trữ danh sách các hạt cát đang chuyển động
    let sandParticles = [];

    // - Tính toán chính xác bán kính (độ rộng từ trục giữa ra thành kính) của bầu thủy tinh đồng hồ cát tại bất kỳ vị trí chiều cao y nào
    // - Đồng hồ cát không phải là một hình trụ thẳng mà có dáng uốn cong mềm mại (hẹp ở giữa cổ và phình to ở 2 bầu trên/dưới)
    // - Hàm này đóng vai trò toán học mô phỏng đường cong thủy tinh đó bằng Đường cong Bézier bậc 3 (Cubic Bézier Curve), phục vụ các mục đích:
    // 1) Giới hạn hạt cát: Giúp các hạt cát khi rơi hay nằm trong bầu kính không bao giờ bị chui ra ngoài viền thủy tinh
    // 2) Cắt hình ảnh & Mặt cát: Giúp hiệu ứng mặt cát dâng lên và hình ảnh hiển thị đúng theo dáng phình/thắt của chiếc đồng hồ
    // 3) Đảm bảo đối xứng 100: Bầu trên và bầu dưới có hình dáng hoàn toàn đối xứng qua điểm thắt ở trung tâm cổ đồng hồ (NECK_Y)
    function getGlassWidthAt(y) {

        // Giới hạn bầu kính nằm trong khoảng y từ TOP_BULB_MIN_Y 35 đến BOTTOM_BULB_MAX_Y 470, 
        // nếu không nằm trong khoảng này điểm đó không thuộc phần thủy tinh
        if (y < TOP_BULB_MIN_Y || y > BOTTOM_BULB_MAX_Y) return 0;

        // Tính khoảng cách theo chiều dọc từ vị trí y đến tâm cổ
        // Hàm Math.abs (giá trị tuyệt đối) giúp bầu trên và bầu dưới tính ra kết quả bán kính giống hệt nhau, tạo ra độ đối xứng hoàn hảo
        let dy = Math.abs(y - NECK_Y);

        // Trong phạm vi 10px quanh cổ (y từ 240 đến 260), thành kính chạy thẳng song song với bán kính hẹp nhất cố định là NECK_W = 14px
        if (dy <= 10) return NECK_W;

        // Chuẩn hóa tham số t về khoảng [0, 1]
        // Độ dài từ sát cổ (dy = 10) đến điểm phình nhất của bầu (dy = 220) là 210px
        // Phép chia (dy - 10) / 210 giúp chuyển đổi khoảng cách dy thành tham số t chạy từ 0 đến 1
        // Sát cổ đồng hồ (dy = 10) => t = 0
        // Nơi bầu phình to nhất (dy = 220) => t = 1.
        let t = (dy - 10) / 210;

        // Đảm bảo t không vượt quá 1 nếu y nằm ở mép sát đế
        if (t > 1) t = 1;

        // Công thức đường cong Bézier bậc 3 (Cubic Bézier)
        // Giúp bán kính bw tăng từ 14px đến 98px theo một đường cong mềm mại, tự nhiên như chiếc đồng hồ cát thật, thay vì là một đường thẳng gấp khúc thô cứng
        let bw = (1 - t) * (1 - t) * (1 - t) * NECK_W +
            3 * (1 - t) * (1 - t) * t * NECK_W +
            3 * (1 - t) * t * t * 98 +
            t * t * t * 98;
        return bw;
    }

    // Nạp ảnh và tạo canvas HD sắc nét 100% gốc không bị nhòe
    function loadAndProcessImage(src, callback) {
        const img = new Image();
        img.crossOrigin = 'Anonymous'; // Cho phép nạp ảnh từ domain khác  (tránh lỗi bảo mật CORS khi vẽ ảnh lên <canvas>)

        img.onload = () => {
            // Tạo một phần tử Canvas trong bộ nhớ không chèn trực tiếp vào trang web
            // Nếu không append vào DOM thì người dùng sẽ không nhìn thấy. Thường dùng làm bộ đệm để xử lý ảnh hoặc vẽ trước khi hiển thị
            hdCanvas = document.createElement('canvas');

            // Tăng kích thước vùng vẽ của canvas lên 2 lần theo mỗi chiều (388 × 444 px thay vì 194 × 222 px)
            // Điều này tạo thêm số lượng pixel để render. Nếu canvas được hiển thị ở kích thước gốc hoặc được scale đúng cách (ví dụ cho màn hình Retina), hình ảnh sẽ hiển thị sắc nét hơn
            hdCanvas.width = targetW * 2;
            hdCanvas.height = targetH * 2;

            const hdCtx = hdCanvas.getContext('2d');

            hdCtx.imageSmoothingEnabled = true; // Bật tính năng nội suy (image smoothing) khi vẽ hoặc thu/phóng hình ảnh. Khi đó trình duyệt sẽ nội suy để ảnh mịn hơn
            hdCtx.imageSmoothingQuality = 'high'; // Yêu cầu trình duyệt sử dụng chất lượng nội suy cao khi imageSmoothingEnabled đang bật. Giúp giảm hiện tượng răng cưa khi scale. Giúp kết quả đẹp hơn khi resize

            // Tính tỉ lệ chiều rộng / chiều cao của ảnh gốc và của khung chứa đích
            // Nó đảm bảo không méo ảnh, phủ kín toàn bộ canvas, có thể bị crop
            const imgAspect = img.width / img.height;
            const targetAspect = targetW / targetH;
            let rw, rh, rx, ry;

            // Nếu ảnh béo/rộng hơn khung chứa (Nếu ảnh có tỉ lệ rộng hơn (landscape hơn) so với khung đích)
            if (imgAspect > targetAspect) {
                rh = hdCanvas.height; // Chiều cao ảnh vẽ (rh) sẽ ăn đầy 100% chiều cao canvas
                rw = hdCanvas.height * imgAspect; // Chiều rộng (rw) được tính theo đúng tỉ lệ gốc của ảnh để tránh bị méo
                rx = (hdCanvas.width - rw) / 2; //  Căn giữa ảnh theo chiều ngang. Nếu ảnh rộng hơn canvas thì rx sẽ âm, khiến hai mép bị cắt đều
                ry = 0;
            }
            // Nếu ảnh thon/dài hơn khung target
            else {
                rw = hdCanvas.width; // Chiều rộng ảnh vẽ (rw) sẽ ăn đầy 100% chiều rộng canvas
                rh = hdCanvas.width / imgAspect; // Chiều cao (rh) được tính theo đúng tỉ lệ gốc của ảnh để tránh bị méo
                rx = 0;
                ry = (hdCanvas.height - rh) / 2; // Căn giữa ảnh theo chiều dọc. Nếu ảnh cao hơn canvas thì phần dư trên/dưới sẽ bị cắt đều
            }

            // Kiểm tra xem đồng hồ cát hiện có đang ở trạng thái lật ngược (180°, 540°, ...) không ?
            const isFlipped = Math.abs(Math.round(currentAngle / 180)) % 2 !== 0;

            if (isFlipped) {
                // Khi đồng hồ cát lật 180deg, xoay ảnh 180deg trong canvas để triệt tiêu góc lật CSS. Hai phép quay sẽ bù trừ nhau, nên khi hiển thị ra ngoài ảnh vẫn luôn đúng chiều
                // -> Đảm bảo bức ảnh LUÔN LUÔN xuôi chiều (đúng chiều dọc, không bao giờ bị ngược đầu)

                // Hai lần xoay 180deg triệt tiêu lẫn nhau, bức ảnh hiển thị ra ngoài luôn đúng chiều thẳng đứng
                // (Canvas quay 180° + CSS quay 180° = 360 => Ảnh nhìn như không quay)

                // Lưu lại toàn bộ trạng thái (state) hiện tại của Canvas Context vào một ngăn xếp (stack). Nó không lưu nội dung hình ảnh đã vẽ, chỉ lưu các thiết lập vẽ
                // Lưu trạng thái hiện tại của Canvas Context (hệ tọa độ, góc quay, tỉ lệ, kiểu vẽ...) để có thể khôi phục sau khi xoay ảnh
                hdCtx.save();


                hdCtx.translate(hdCanvas.width / 2, hdCanvas.height / 2); // Dời gốc tọa độ về tâm của Canvas ẩn

                hdCtx.rotate(Math.PI); // Xoay bản thân bức ảnh trước 180 deg trong canvas

                hdCtx.drawImage(
                    img,
                    rx - hdCanvas.width / 2,
                    ry - hdCanvas.height / 2,
                    rw,
                    rh
                ); // Vẽ ảnh tại tọa độ đã dịch chuyển (Vẽ ảnh theo hệ tọa độ mới (đã translate và rotate))

                // Khôi phục trạng thái Canvas gần nhất đã được lưu bằng save(). Sau restore() mọi thứ quay trở về: Origin = (0,0), Rotation = 0°, Scale = 1
                // Như chưa từng translate() hay rotate(). save() và restore() hoạt động theo Stack. restore() luôn lấy trạng thái ở trên cùng của stack
                // Bạn chỉ muốn: Background => Photo quay 180° => Text bình thường. Nếu bỏ restore() thì: Background => Photo quay 180° => Text cũng quay
                hdCtx.restore();
            } else {
                // Vẽ ảnh trực tiếp lên canvas tại vị trí (rx, ry) với kích thước (rw, rh)
                hdCtx.drawImage(img, rx, ry, rw, rh);
            }

            // Khởi tạo 240 hạt cát ở bầu thủy tinh phía trên
            sandParticles = [];
            for (let i = 0; i < 240; i++) {
                let topY = TOP_BULB_MIN_Y + Math.random() * (TOP_BULB_MAX_Y - TOP_BULB_MIN_Y - 20);
                let maxTopR = getGlassWidthAt(topY) - 6;
                let topX = CX + (Math.random() - 0.5) * maxTopR * 1.6;
                sandParticles.push({
                    x: topX,
                    y: topY,
                    vx: (Math.random() - 0.5) * 0.4,
                    vy: 0.8 + Math.random() * 1.6,
                    size: 2.2 + Math.random() * 1.2,
                    color: `rgba(255, ${200 + Math.floor(Math.random() * 55)}, ${120 + Math.floor(Math.random() * 80)}, ${0.7 + Math.random() * 0.3})`
                });
            }

            callback();
        };
        img.src = src;
    }

    function initHourglass() {
        state = 'LOADING';
        loadAndProcessImage(imageSources[currentImgIdx], () => {
            state = 'FILLING';
            stateTimer = 0;
            shineProgress = -1;
        });
    }

    // Kích hoạt xoay lật đồng hồ cát 180 độ
    let intervalTriggerFlip = null;
    function triggerFlip() {
        if (intervalTriggerFlip) {
            clearTimeout(intervalTriggerFlip);
            intervalTriggerFlip = null;
        }

        // Nếu đồng hồ cát đang trong quá trình lật ('FLIPPING') hoặc đang tải ảnh ('LOADING')
        if (state === 'FLIPPING' || state === 'LOADING') return;

        // Kích hoạt trạng thái lật của đồng hồ cát. 
        // Khi state === 'FLIPPING', nó sẽ dừng hoàn toàn việc tính toán cát rơi hay dâng ảnh ở bầu dưới
        state = 'FLIPPING';
        //  Phép cộng góc xoay tích lũy (Tăng biến currentAngle thêm 180deg so với giá trị hiện tại)
        currentAngle += 180;

        // Xoay toàn bộ khung đồng hồ cát mượt mà trong 1.2 giây
        wrapper.style.transform = `rotate(${currentAngle}deg)`;

        intervalTriggerFlip = setTimeout(() => {
            // Chuyển sang ảnh tiếp theo
            // VD: 
            // - Đang ở ảnh 0: (0 + 1) % 8 = 1 (Phép chia lấy dư: 1 chia 8 dư 1)
            // - Đang ở ảnh 7: (7 + 1) % 8 = 0 (Phép chia lấy dư: 8 chia 8 dư 0)
            // => Giúp danh sách ảnh tự động phát lặp lại vô tận
            currentImgIdx = (currentImgIdx + 1) % imageSources.length;

            // Gọi lại hàm khởi tạo đồng hồ cát cho bức ảnh mới vừa được chọn
            initHourglass();
        }, 1300);
    }

    // Cắt khung hình theo đúng biên dạng bầu đồng hồ cát dưới
    function clipLowerBulb() {
        ctx.beginPath();
        ctx.moveTo(CX - NECK_W, NECK_Y);
        ctx.bezierCurveTo(CX - NECK_W, 305, CX - 98, 385, CX - 98, BOTTOM_BULB_MAX_Y);
        ctx.lineTo(CX + 98, BOTTOM_BULB_MAX_Y);
        ctx.bezierCurveTo(CX + 98, 385, CX + NECK_W, 305, CX + NECK_W, NECK_Y);
        ctx.closePath();
    }

    // Vẽ bức ảnh HD sắc nét gốc bị lấp dần bởi mặt cát đang dâng lên
    function renderHDPhoto(fillY) {
        if (!hdCanvas) return;
        let visibleH = BOTTOM_BULB_MAX_Y - fillY;
        if (visibleH <= 0) return;

        ctx.save();
        clipLowerBulb();
        ctx.clip();

        let srcY = ((fillY - startY) / targetH) * hdCanvas.height;
        let srcH = (visibleH / targetH) * hdCanvas.height;

        // Draw ảnh sắc nét 100% HD không pixelate
        ctx.drawImage(
            hdCanvas,
            0, srcY, hdCanvas.width, srcH,
            startX, fillY, targetW, visibleH
        );

        // Hạt cát lấp lánh ở bờ cát dâng lên
        if (state === 'FILLING' && fillY > startY + 5) {
            let edgeR = getGlassWidthAt(fillY) - 4;
            for (let i = 0; i < 18; i++) {
                let px = CX + (Math.random() - 0.5) * edgeR * 1.8;
                let py = fillY + (Math.random() - 0.5) * 3;
                ctx.fillStyle = `rgba(255, 235, 170, ${0.5 + Math.random() * 0.5})`;
                ctx.fillRect(px, py, 2, 2);
            }
        }

        ctx.restore();
    }

    // Vẽ dòng cát chảy từ bầu trên qua cổ đồng hồ
    function renderFallingSand(currentFillY) {
        for (let i = 0; i < sandParticles.length; i++) {
            let p = sandParticles[i];
            if (p.y < NECK_Y) {
                p.x += (CX - p.x) * 0.05 + p.vx;
                p.y += p.vy;
                if (p.y >= NECK_Y) {
                    p.x = CX + (Math.random() - 0.5) * (NECK_W - 2);
                }
            } else if (p.y < currentFillY) {
                p.y += p.vy * 2.5;
                p.x += (Math.random() - 0.5) * 1.2;
            } else {
                p.y = TOP_BULB_MIN_Y + Math.random() * 35;
                let maxTopR = getGlassWidthAt(p.y) - 6;
                p.x = CX + (Math.random() - 0.5) * maxTopR * 1.5;
            }

            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Tia cát mịn chảy ở cổ
        if (currentFillY > startY + 5) {
            ctx.fillStyle = 'rgba(255, 215, 0, 0.85)';
            ctx.fillRect(CX - 1.5, NECK_Y - 4, 3, currentFillY - NECK_Y);
        }
    }

    // Vòng lặp Render chính
    function updateAndRender() {
        ctx.clearRect(0, 0, W, H);

        // 1. Vẽ khung thủy tinh đồng hồ cát ôm sát vừa vặn ảnh
        drawGlassContainer();

        if (state === 'FILLING') {
            stateTimer++;
            // Tiến độ dâng cát từ 0 -> 1 trong ~2.6 giây (155 frames)
            let fillProgress = Math.min(1, stateTimer / 155);
            let currentFillY = BOTTOM_BULB_MAX_Y - fillProgress * (BOTTOM_BULB_MAX_Y - startY);

            // Render ảnh Full HD dâng dần theo mức cát
            renderHDPhoto(currentFillY);

            // Vẽ dòng cát chảy từ cổ đồng hồ
            renderFallingSand(currentFillY);

            if (fillProgress >= 1) {
                state = 'HOLD';
                stateTimer = 0;
                shineProgress = 0;
            }

        } else if (state === 'HOLD') {
            stateTimer++;

            // Hiển thị bức ảnh Full HD hoàn chỉnh 100% sắc nét
            renderHDPhoto(startY);

            // Hiệu ứng sóng sáng lướt qua bức ảnh
            if (shineProgress >= 0 && shineProgress <= 260) {
                shineProgress += 4.5;
                let gradient = ctx.createLinearGradient(
                    CX - 130 + shineProgress, startY,
                    CX - 60 + shineProgress, BOTTOM_BULB_MAX_Y
                );
                gradient.addColorStop(0, 'rgba(255,255,255,0)');
                gradient.addColorStop(0.5, 'rgba(255,255,255,0.4)');
                gradient.addColorStop(1, 'rgba(255,255,255,0)');

                ctx.save();
                clipLowerBulb();
                ctx.clip();
                ctx.fillStyle = gradient;
                ctx.fillRect(CX - 130, startY, 260, targetH + 10);
                ctx.restore();
            }

            // Tự động lật sau khi hiển thị bức ảnh đầy đủ trong ~2.6 giây
            if (stateTimer > 160) {
                triggerFlip();
            }
        }

        requestAnimationFrame(updateAndRender);
    }

    // Vẽ hình thể bầu thủy tinh đồng hồ cát ôm sát ảnh
    function drawGlassContainer() {
        ctx.save();

        ctx.beginPath();
        // Bầu trên
        ctx.moveTo(CX - 98, TOP_BULB_MIN_Y);
        ctx.bezierCurveTo(CX - 98, 110, CX - NECK_W, 180, CX - NECK_W, NECK_Y);
        // Bầu dưới ôm sát khung ảnh
        ctx.bezierCurveTo(CX - NECK_W, 305, CX - 98, 385, CX - 98, BOTTOM_BULB_MAX_Y);
        ctx.lineTo(CX + 98, BOTTOM_BULB_MAX_Y);
        ctx.bezierCurveTo(CX + 98, 385, CX + NECK_W, 305, CX + NECK_W, NECK_Y);
        ctx.bezierCurveTo(CX + NECK_W, 180, CX + 98, 110, CX + 98, TOP_BULB_MIN_Y);
        ctx.closePath();

        let bgGrad = ctx.createLinearGradient(0, TOP_BULB_MIN_Y, 0, BOTTOM_BULB_MAX_Y);
        bgGrad.addColorStop(0, 'rgba(255, 255, 255, 0.04)');
        bgGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
        bgGrad.addColorStop(1, 'rgba(255, 255, 255, 0.04)');
        ctx.fillStyle = bgGrad;
        ctx.fill();

        ctx.lineWidth = 3.5;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.stroke();

        ctx.restore();
    }

    // Khởi chạy Engine
    initHourglass();
    requestAnimationFrame(updateAndRender);
})();