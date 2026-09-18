/**
 * =========================================================================================
 * FILE: browser_config.mjs
 * MỤC ĐÍCH:
 *   Module Cấu Hình Môi Trường Trình Duyệt Đa Nền Tảng (Cross-Platform Browser Resolver):
 *     1. Tự động nhận diện hệ điều hành đang chạy (Linux, Windows, macOS).
 *     2. Định tuyến đường dẫn nhị phân (Binary Executable Path) của trình duyệt Google Chrome hoặc Microsoft Edge.
 *     3. Quản lý và cô lập thư mục dữ liệu cá nhân (User Data Directory / Profile Isolation):
 *        - Mỗi tài khoản email sẽ sở hữu một thư mục riêng biệt trong `ChromeProfiles/<email>`.
 *        - Đảm bảo Cookie, LocalStorage, Cache, IndexedDB của các tài khoản KHÔNG bị lẫn lộn vào nhau.
 * =========================================================================================
 */

import os from 'os';           // Thư viện hệ điều hành của Node.js để kiểm tra platform, homedir
import path from 'path';       // Thư viện thao tác chuẩn hoá đường dẫn file
import { fileURLToPath } from 'url'; // Chuyển đổi file URL (import.meta.url) thành đường dẫn tệp tin tuyệt đối

/**
 * Hàm getBrowserConfig: Xác định file thực thi và thư mục lưu Profile cho từng tài khoản và hệ điều hành.
 * 
 * @param {string} [browserType='chrome'] - Loại trình duyệt được chọn: 'chrome' (mặc định) hoặc 'edge'.
 * @param {string|null} [email=null] - Email tài khoản tương ứng với Profile cần mở.
 *                                     Nếu có email, thư mục profile sẽ được trỏ vào `ChromeProfiles/<email>`.
 * @returns {{ executablePath: string, userDataDir: string }}
 *          - `executablePath`: Đường dẫn tuyệt đối tới file chạy của Chrome/Edge.
 *          - `userDataDir`: Đường dẫn thư mục dữ liệu cá nhân để lưu giữ Cookie/Phiên đăng nhập.
 */
export function getBrowserConfig(browserType = 'chrome', email = null) {
    // Lấy tên định danh hệ điều hành: 'linux' | 'win32' | 'darwin'
    const platform = os.platform();
    // Lấy thư mục gốc người dùng hiện tại (Home Directory, VD: /home/dev hoặc C:\Users\Username)
    const homeDir = os.homedir();
    
    let executablePath = '';
    let userDataDir = '';

    // =====================================================================================
    // TRƯỜNG HỢP 1: HỆ ĐIỀU HÀNH LINUX (Ubuntu, Debian, CentOS...)
    // =====================================================================================
    if (platform === 'linux') {
        if (browserType === 'edge') {
            executablePath = '/usr/bin/microsoft-edge';
            userDataDir = path.join(homeDir, '.config', 'microsoft-edge');
        } else {
            // Google Chrome mặc định trên hệ thống Linux
            executablePath = '/usr/bin/google-chrome';
            userDataDir = path.join(homeDir, '.config', 'google-chrome');
        }
    } 
    // =====================================================================================
    // TRƯỜNG HỢP 2: HỆ ĐIỀU HÀNH WINDOWS (Windows 10, Windows 11, Windows Server)
    // =====================================================================================
    else if (platform === 'win32') {
        if (browserType === 'edge') {
            executablePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
            userDataDir = path.join(homeDir, 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data');
        } else {
            // Google Chrome mặc định trong thư mục Program Files của Windows
            executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
            userDataDir = path.join(homeDir, 'AppData', 'Local', 'Google', 'Chrome', 'User Data');
        }
    } 
    // =====================================================================================
    // TRƯỜNG HỢP 3: HỆ ĐIỀU HÀNH MACOS (macOS Sonoma, Ventura, Monterey...)
    // =====================================================================================
    else if (platform === 'darwin') {
        if (browserType === 'edge') {
            executablePath = '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';
            userDataDir = path.join(homeDir, 'Library', 'Application Support', 'Microsoft Edge');
        } else {
            // Google Chrome mặc định trên macOS
            executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
            userDataDir = path.join(homeDir, 'Library', 'Application Support', 'Google', 'Chrome');
        }
    }
    
    // =====================================================================================
    // CƠ CHẾ CÔ LẬP PROFILE THEO EMAIL (PROFILE ISOLATION):
    // =====================================================================================
    // Nếu có truyền email, chúng ta KHÔNG dùng thư mục Profile mặc định của hệ thống
    // mà sẽ tạo một thư mục riêng biệt cho tài khoản đó nằm trong `ChromeProfiles/<email>` ở thư mục gốc dự án.
    if (email) {
        // Lấy đường dẫn tuyệt đối của thư mục chứa file browser_config.mjs hiện tại
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        
        // Trỏ vào thư mục: <gốc_dự_án>/ChromeProfiles/<email>
        // Ví dụ: /home/dev/_Tool_postman_Sep17/ChromeProfiles/user1@maildrop.cc
        userDataDir = path.join(__dirname, 'ChromeProfiles', email);
    }

    // Trả về bộ cấu hình hoàn chỉnh cho Puppeteer khởi động
    return { executablePath, userDataDir };
}
