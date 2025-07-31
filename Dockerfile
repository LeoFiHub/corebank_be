# Sử dụng image Node.js làm base
FROM node:20-alpine

# Đặt thư mục làm việc bên trong container
WORKDIR /app

# Copy package.json và package-lock.json để cài đặt dependencies
COPY package*.json ./

# Cài đặt dependencies
RUN npm install

# Copy toàn bộ mã nguồn vào container
COPY . .

# Biên dịch ứng dụng TypeScript
#RUN npm run build

# Expose cổng mà ứng dụng sẽ lắng nghe (ví dụ: 3000)
EXPOSE 3000

# Lệnh để chạy ứng dụng khi container khởi động
CMD ["npm", "run", "dev"]