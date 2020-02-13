FROM ubuntu:19.10

RUN rm /bin/sh && ln -s /bin/bash /bin/sh
ENV SHELL /bin/bash

RUN apt-get update -y \
    && apt-get install -y git curl build-essential libsqlite3-dev zlib1g-dev \
    && git clone https://github.com/mapbox/tippecanoe.git \
    && cd tippecanoe \
    && make -j \
    && make install \
    && cd .. \
    && curl 'https://nodejs.org/dist/v13.8.0/node-v13.8.0-linux-x64.tar.gz' | tar -xzv \
    && cp ./node-v13.8.0-linux-x64/bin/node /usr/bin/ \
    && ./node-v13.8.0-linux-x64/bin/npm install -g npm \
    && npm install -g yarn

WORKDIR /usr/local/src/chip-viz
ADD . /usr/local/src/chip-viz

RUN yarn install
