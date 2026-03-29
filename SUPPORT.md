# Help Center | 帮助中心

欢迎来到 **Freshness Above All!** 帮助中心。  
Welcome to the **Freshness Above All!** Help Center.

这个页面用于帮助你快速上手应用、理解主要功能，并在遇到常见问题时找到解决方法。  
This page helps you get started quickly, understand the main features, and find solutions to common issues.

## About Freshness Above All! | 关于 Freshness Above All!

Freshness Above All! 是一个本地优先的食材保鲜追踪应用，用来帮助你：  
Freshness Above All! is a local-first food freshness tracker designed to help you:

- 记录家中食材库存  
  Track household food inventory
- 跟踪食材到期时间  
  Monitor expiration dates
- 通过分类、筛选和排序快速查找食材  
  Find items quickly with categories, filters, and sorting
- 使用条码扫描或手动输入添加食材  
  Add food by barcode scan or manual entry
- 将清理掉的食材移入 Trash，并在需要时恢复  
  Move removed items into Trash and restore them when needed
- 保存提醒、主题和清理策略等设置  
  Save reminder, theme, and cleanup preferences

目前这是一个轻量级原型，数据默认保存在本地 JSON 文件中。  
This is currently a lightweight prototype, and data is stored locally in JSON files by default.

## Getting Started | 快速开始

首次使用时，建议按下面顺序操作：  
For first-time use, this is the recommended flow:

1. 打开 Dashboard，查看即将过期和已过期食材概览  
   Open the Dashboard to review expiring and expired items
2. 进入 `Add Food`，手动添加一项食材  
   Go to `Add Food` and create an item manually
3. 为食材设置名称、分类和到期日期  
   Set the food name, category, and expiration date
4. 保存后到 `All Food` 页面检查是否录入成功  
   Save it and confirm it appears in `All Food`
5. 如需整理库存，可在 `All Food` 中筛选、排序或批量处理  
   Use filters, sorting, or batch actions in `All Food` to manage inventory

## Main Features | 主要功能

### Dashboard | 首页看板

Dashboard 会显示当前库存的保鲜情况摘要，包括：  
The Dashboard provides a freshness summary of your current inventory, including:

- 已过期食材数量  
  Number of expired items
- 今天到期食材数量  
  Number of items expiring today
- 3 天内到期食材数量  
  Number of items expiring within 3 days
- 最近添加或需要优先关注的食材  
  Recently added or high-priority items

你可以点击不同统计卡片，快速聚焦某一类食材。  
You can tap different summary cards to focus on a specific group of items.

### All Food | 全部食材

`All Food` 页面用于查看完整库存，并支持：  
The `All Food` page is where you manage the full inventory, with support for:

- 搜索食材名称  
  Searching by food name
- 按状态、分类或图标筛选  
  Filtering by status, category, or icon
- 按到期时间排序  
  Sorting by expiration date
- 批量选择食材  
  Batch selection
- 批量清理不需要的食材  
  Batch cleanup
- 打开食材详情页查看具体信息  
  Opening item detail sheets

如果你的库存变多，这会是最常用的管理页面。  
As your inventory grows, this will likely become the page you use most.

### Add Food | 添加食材

在 `Add Food` 中，你可以通过两种方式录入食材：  
In `Add Food`, you can create items in two ways:

- 手动输入  
  Manual entry
- 扫描条码  
  Barcode scan

可填写的信息通常包括：  
Typical fields include:

- 食材名称  
  Food name
- 分类  
  Category
- 到期日期  
  Expiration date
- 规格或大小  
  Size or quantity
- 图标  
  Icon
- 条码  
  Barcode

如果是编辑现有食材，系统会保留当前设置并高亮显示已选择内容。  
When editing an existing item, the current selections are preserved and highlighted.

### Barcode Scan | 条码扫描

扫描条码功能适合快速录入包装食品。  
Barcode scanning is intended for quickly adding packaged food items.

使用方式：  
How to use it:

1. 打开 `Add Food`  
   Open `Add Food`
2. 选择 `Scan Barcode`  
   Choose `Scan Barcode`
3. 点击 `Start Scan`  
   Click `Start Scan`
4. 允许浏览器访问摄像头  
   Allow browser camera access
5. 将条码放入扫描框内  
   Place the barcode inside the scan frame

识别成功后，系统会：  
After a successful scan, the app will:

- 自动记录条码  
  Save the barcode automatically
- 尝试复用本地已存在的商品信息  
  Reuse matching local item data when available
- 在需要时查询 Open Food Facts 补全信息  
  Query Open Food Facts for additional details when needed

如果未找到商品信息，你仍然可以手动完成剩余字段。  
If no product match is found, you can still complete the remaining fields manually.

### Trash | 回收区

当你删除或清理食材时，项目不会立刻永久消失，而是进入 `Trash`。  
When you remove or clean up food items, they are not permanently deleted right away. They are moved into `Trash`.

你可以在 Trash 中：  
Inside Trash, you can:

- 查看已删除食材  
  Review deleted items
- 阅读删除原因  
  See the cleanup reason
- 恢复食材到主库存  
  Restore items back to the main inventory
- 手动清空回收内容  
  Empty trash manually

这能减少误删带来的影响。  
This helps reduce the impact of accidental deletion.

### Settings | 设置

`Settings` 页面用于控制应用行为，例如：  
The `Settings` page controls app behavior such as:

- 提醒策略  
  Reminder strategy
- 主题显示  
  Theme display
- Trash 自动删除天数  
  Trash auto-delete period
- 声音音量  
  Sound volume

修改后的设置会被保存，后续打开应用时继续生效。  
Updated settings are persisted and remain active the next time you open the app.

## Frequently Asked Questions | 常见问题

### Why can’t I scan a barcode? | 为什么我无法扫描条码？

请检查以下几项：  
Check the following:

- 你是否通过 `http://localhost:3000` 打开应用，而不是直接打开 `index.html`  
  Make sure you opened the app through `http://localhost:3000`, not directly from `index.html`
- 浏览器是否支持 `getUserMedia` 和 `BarcodeDetector`  
  Confirm your browser supports `getUserMedia` and `BarcodeDetector`
- 浏览器是否已获得摄像头权限  
  Confirm camera permission has been granted
- 设备摄像头是否可正常使用  
  Make sure the device camera works normally

如果扫描不可用，可以改用手动输入条码。  
If scanning is unavailable, you can still enter the barcode manually.

### Why didn’t barcode lookup fill in the food details? | 为什么条码查询没有自动补全信息？

可能原因包括：  
Possible reasons include:

- 该条码不在 Open Food Facts 数据库中  
  The barcode is not available in the Open Food Facts database
- 当前网络不可用  
  The network is unavailable
- 第三方数据返回内容不完整  
  The third-party response is incomplete

在这些情况下，系统仍会保留条码，你可以手动补充信息。  
In these cases, the barcode is still saved and you can complete the rest manually.

### Where is my data stored? | 我的数据存在哪里？

当前版本的数据主要保存在本地文件中，例如：  
At the moment, data is primarily stored in local files such as:

- `food.json`：当前库存  
  `food.json`: active inventory
- `trash.json`：已删除但可恢复的食材  
  `trash.json`: deleted items that can still be restored
- `setting.json`：应用设置  
  `setting.json`: app settings

这意味着当前项目更适合作为单用户、本地原型使用。  
This means the current project is best treated as a single-user local prototype.

### Can I recover deleted food items? | 删除的食材还能恢复吗？

可以。  
Yes.

只要食材仍在 `Trash` 中，就可以将它恢复回主库存。如果 Trash 被手动清空，或超过自动删除期限，则可能无法恢复。  
As long as the item is still in `Trash`, it can be restored to the main inventory. If Trash has been emptied manually or auto-deletion has already happened, recovery may no longer be possible.

### Why are my reminders or calendar features limited? | 为什么提醒或日历功能看起来比较有限？

当前版本中的提醒和日历功能仍以原型展示和界面组织为主，部分行为还没有实现成完整通知系统。  
In the current version, reminder and calendar behavior is still mostly at the prototype and UI level, and not all interactions are implemented as a full notification system yet.

### Why do I still see the previous account's data right after logging in or switching accounts? | 为什么登录或切换账号后，页面上还是上一个账号的数据？

当前版本中，账号切换后的页面数据有时不会立即自动刷新。  
In the current version, page data may not refresh immediately after logging in or switching accounts.

如果你已经成功登录，但看到的还是上一个账号的数据，请先手动刷新页面一次。  
If you have already signed in successfully but still see the previous account's data, refresh the page once manually.

刷新后，页面会重新加载当前账号对应的数据。  
After refreshing, the app will reload the data that belongs to the currently signed-in account.

## Troubleshooting | 故障排查

### The app does not open correctly | 应用无法正常打开

请确认你已经启动本地服务：  
Make sure the local server is running:

```bash
npm install
npm start
```

然后在浏览器中访问：  
Then open the app in your browser:

```text
http://localhost:3000
```

### The page shows a load error | 页面出现加载错误

这通常表示某个脚本未正确加载。建议：  
This usually means one of the scripts did not load correctly. Try the following:

- 检查本地服务是否正常启动  
  Confirm the local server is running
- 刷新页面重试  
  Refresh the page
- 确认相关文件没有被移动或删除  
  Make sure required files have not been moved or deleted

### Camera permission was denied | 摄像头权限被拒绝

如果你曾拒绝过摄像头权限，需要去浏览器设置中重新允许。  
If you previously denied camera access, you need to re-enable it in your browser settings.

在 macOS 上，也建议检查：  
On macOS, also check:

- `System Settings -> Privacy & Security -> Camera`  
  `System Settings -> Privacy & Security -> Camera`
- 浏览器站点权限中的 Camera 设置  
  The site's Camera permission inside your browser

### Changes are not being saved | 修改没有成功保存

请确认：  
Please confirm:

- 本地服务正在运行  
  The local server is running
- 项目文件具有可写权限  
  The project files are writable
- 本地 JSON 数据文件没有损坏  
  The local JSON data files are not corrupted

## Limitations | 当前限制

当前版本有以下限制：  
The current version has the following limitations:

- 没有用户登录系统  
  No user authentication
- 没有云同步  
  No cloud sync
- 没有数据库  
  No database
- 多设备共享能力有限  
  Limited multi-device support
- 条码识别依赖浏览器能力  
  Barcode scanning depends on browser support
- 商品信息补全依赖第三方数据源  
  Product autofill depends on third-party data sources

## Best Practices | 使用建议

为了获得更好的使用体验，建议：  
For a smoother experience, it is recommended to:

- 添加食材时尽量填写准确的到期日期  
  Enter accurate expiration dates whenever possible
- 定期查看 Dashboard 和 All Food  
  Review the Dashboard and `All Food` regularly
- 清理前先确认是否需要保留记录  
  Double-check before cleaning up items
- 将 Trash 作为误删恢复区，而不是长期存档区  
  Use Trash as a recovery area, not long-term storage
- 使用本地服务运行应用，以确保扫码功能正常  
  Run the app through the local server so barcode scanning works correctly

## Need More Help? | 还需要更多帮助？

如果你正在为这个项目继续开发，建议优先检查：  
If you are continuing development on this project, check these areas first:

- 前端页面是否正常加载  
  Whether the frontend loads correctly
- 本地 API 是否成功读写 JSON 文件  
  Whether the local API can read and write JSON files
- 扫码功能是否有浏览器兼容性问题  
  Whether barcode scanning has browser compatibility issues
- 第三方条码查询接口是否可用  
  Whether the third-party barcode lookup service is available
