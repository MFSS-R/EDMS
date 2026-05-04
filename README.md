# 瀹為獙鏁版嵁绠＄悊绯荤粺 (EDMS)

涓€濂椾笓涓烘潗鏂欏悎鎴愬疄楠岃璁＄殑鏁版嵁绠＄悊绯荤粺锛岄噰鐢?React + Django 鍓嶅悗绔垎绂绘灦鏋勩€?
## 鍔熻兘鐗圭偣

- **椤圭洰绠＄悊**锛氬垱寤哄拰绠＄悊澶氫釜鐮旂┒椤圭洰
- **鏍峰搧绠＄悊**锛氱伒娲荤殑鏍峰搧缂栧彿绯荤粺锛屾敮鎸佸姩鎬佸埗澶囨潯浠?- **娴嬭瘯鏁版嵁绠＄悊**锛氬姩鎬佹祴璇曠被鍨嬶紝鏀寔澶氭枃浠朵笂浼?- **鏁版嵁瀵煎嚭**锛氭敮鎸佸鍑烘牱鍝佸垪琛ㄥ拰娴嬭瘯鏁版嵁涓篍xcel鏍煎紡
- **鏉冮檺鎺у埗**锛氱敤鎴峰彧鑳借闂嚜宸卞垱寤虹殑鏁版嵁
- **鏂囦欢鏍戝鑸?*锛氱洿瑙傜殑鏍戝舰缁撴瀯娴忚鏁版嵁

## 鎶€鏈爤

### 鍚庣
- Django 4.2 LTS
- Django REST Framework
- JWT璁よ瘉
- SQLite / PostgreSQL

### 鍓嶇
- React 18
- Ant Design 5
- React Router 6
- Zustand (鐘舵€佺鐞?
- React Query (鏁版嵁鑾峰彇)
- Axios

## 椤圭洰缁撴瀯

```
edms/
鈹溾攢鈹€ backend/                # Django鍚庣
鈹?  鈹溾攢鈹€ manage.py
鈹?  鈹溾攢鈹€ requirements.txt
鈹?  鈹溾攢鈹€ .env.example
鈹?  鈹溾攢鈹€ edms/               # 椤圭洰閰嶇疆
鈹?  鈹溾攢鈹€ apps/               # 搴旂敤妯″潡
鈹?  鈹?  鈹溾攢鈹€ users/          # 鐢ㄦ埛绠＄悊
鈹?  鈹?  鈹溾攢鈹€ projects/       # 椤圭洰绠＄悊
鈹?  鈹?  鈹溾攢鈹€ samples/        # 鏍峰搧绠＄悊
鈹?  鈹?  鈹斺攢鈹€ tests/          # 娴嬭瘯鏁版嵁绠＄悊
鈹?  鈹斺攢鈹€ media/              # 涓婁紶鏂囦欢
鈹溾攢鈹€ frontend/               # React鍓嶇
鈹?  鈹溾攢鈹€ package.json
鈹?  鈹溾攢鈹€ .env.example
鈹?  鈹斺攢鈹€ src/
鈹?      鈹溾攢鈹€ components/     # 鍏叡缁勪欢
鈹?      鈹溾攢鈹€ pages/          # 椤甸潰缁勪欢
鈹?      鈹溾攢鈹€ services/       # API鏈嶅姟
鈹?      鈹溾攢鈹€ store/          # 鐘舵€佺鐞?鈹?      鈹斺攢鈹€ utils/          # 宸ュ叿鍑芥暟
鈹溾攢鈹€ docker-compose.yml
鈹溾攢鈹€ Dockerfile.backend
鈹溾攢鈹€ Dockerfile.frontend
鈹斺攢鈹€ README.md
```

## Local Launcher

For Windows local development, you can use the root scripts:

```bat
start_services.bat
```

The launcher will:
- verify `backend/`, `frontend/`, `venv/`, and `npm`
- auto-create missing `.env` files from `.env.example`
- run `python manage.py check`
- run `python manage.py migrate`
- verify ports `3000` and `8000` are free
- start backend on `http://127.0.0.1:3000`
- start frontend on `http://127.0.0.1:8000`
- write logs to `logs\backend.log` and `logs\frontend.log`
- open the frontend automatically in your browser

To stop local services quickly, use:

```bat
stop_services.bat
```

## 鏈湴寮€鍙?
### 鍚庣璁剧疆

1. 鍒涘缓铏氭嫙鐜骞跺畨瑁呬緷璧栵細
```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
# 鎴?venv\Scripts\activate  # Windows

pip install -r backend/requirements.txt
```

2. 閰嶇疆鐜鍙橀噺锛?```bash
cp backend/.env.example backend/.env
# 缂栬緫 .env 鏂囦欢锛岃缃?SECRET_KEY 绛夐厤缃?```

3. 杩愯鏁版嵁搴撹縼绉伙細
```bash
cd backend
python manage.py migrate
python manage.py createsuperuser  # 鍒涘缓绠＄悊鍛樿处鎴?python manage.py runserver
```

鍚庣鏈嶅姟灏嗗湪 http://localhost:8000 杩愯锛孉PI鏂囨。鍙€氳繃 http://localhost:8000/swagger/ 璁块棶銆?
### 鍓嶇璁剧疆

1. 瀹夎渚濊禆锛?```bash
cd frontend
npm install
```

2. 閰嶇疆鐜鍙橀噺锛?```bash
cp .env.example .env
# 鏍规嵁闇€瑕佷慨鏀归厤缃?```

3. 鍚姩寮€鍙戞湇鍔″櫒锛?```bash
npm run dev
```

鍓嶇鏈嶅姟灏嗗湪 http://localhost:3000 杩愯銆?
## Docker閮ㄧ讲

1. 閰嶇疆鐜鍙橀噺锛?```bash
cp backend/.env.example backend/.env
# 缂栬緫 .env 鏂囦欢锛岃缃敓浜х幆澧冮厤缃?```

2. 鏋勫缓骞跺惎鍔ㄥ鍣細
```bash
docker-compose up -d --build
```

搴旂敤灏嗗湪 http://localhost 杩愯銆?
## API鏂囨。

鍚姩鍚庣鏈嶅姟鍚庯紝鍙€氳繃浠ヤ笅鍦板潃璁块棶API鏂囨。锛?- Swagger UI: http://localhost:8000/swagger/
- ReDoc: http://localhost:8000/redoc/

## 涓昏鍔熻兘

### 鏍峰搧缂栧彿瑙勫垯
鏍峰搧缂栧彿鑷姩鐢熸垚锛屾牸寮忎负锛歚鏉愭枡缂╁啓-YYYYMMDD-搴忓彿`
- 鏉愭枡缂╁啓鐢辩敤鎴疯緭鍏?- 搴忓彿涓哄綋澶╄鏍峰搧绫诲瀷涓嬬殑鏈€澶у簭鍙峰姞1

### 鍒跺鏉′欢
閲囩敤JSONField瀛樺偍锛屾瘡涓牱鍝佸彲浠ユ湁瀹屽叏涓嶅悓鐨勫埗澶囨潯浠跺瓧娈碉紝鏀寔锛?- 鍔ㄦ€佹坊鍔?鍒犻櫎瀛楁
- 浠庡叾浠栨牱鍝佸鍒跺埗澶囨潯浠?
### 娴嬭瘯绫诲瀷
瀹屽叏鍔ㄦ€侊紝涓嶉璁句换浣曟祴璇曠被鍨嬶細
- 鐢ㄦ埛涓婁紶娴嬭瘯鏁版嵁鏃跺垱寤?- 鎸変娇鐢ㄩ鐜囨帓搴?
## 璁稿彲璇?
MIT License


