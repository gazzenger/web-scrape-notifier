#!/bin/sh
# This script outputs virtual mailbox sizes
DIRECTORY=/var/mail/vhosts
OUTPUTLOCATION=/opt/wsn/mailbox-sizes.out
OUTPUTFILEOWNER=wsn

if [ $(/usr/bin/id -u) -ne 0 ]; then
    echo "Not running as root"
    exit
fi

if [ -d "$DIRECTORY" ]; then
    touch $OUTPUTLOCATION
    chown $OUTPUTFILEOWNER:$OUTPUTFILEOWNER $OUTPUTLOCATION
    for domain in $DIRECTORY/*/
    do
    	domain=${domain%*/}
        for email in $domain/*/
        do
            email=${email%*/}
            folderSize=$(du -s $email | cut -f 1)
            echo "${email##*/}@${domain##*/} ${folderSize}" >> $OUTPUTLOCATION
        done
    done
fi
