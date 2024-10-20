FROM node
RUN echo 'DingZhenRefreshToken is running on docker!'
COPY index.js .
COPY . .
RUN npm install
CMD [ "node", "index.js" ]