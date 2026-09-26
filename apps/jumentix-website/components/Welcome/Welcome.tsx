'use client';

import { Fragment } from 'react';

import { TextAnimate } from '@gfazioli/mantine-text-animate';
import { Anchor, Button, Center, Paper, Text, Title } from '@mantine/core';
import { IconBrandGithub, IconExternalLink } from '@tabler/icons-react';

import classes from './Welcome.module.css';
import pack from '../../package.json';
import { ProductHunt } from '../ProductHunt/ProductHunt';

// eslint-disable-next-line import-x/prefer-default-export -- single named export consumed via named imports/barrels; converting to default would change the module API
export const Welcome = () => (
  <Fragment>
    <Center my={64}>
      <ProductHunt />
    </Center>
    <Title className={classes.title} maw="90vw" mx="auto" ta="center">
      Welcome to Mantine Next.js +
      <TextAnimate
        inherit
        animate="in"
        animation="scale"
        by="character"
        component="span"
        duration={2}
        gradient={{ from: 'pink', to: 'yellow' }}
        segmentDelay={0.2}
        variant="gradient"
        animateProps={{
          scaleAmount: 3
        }}
      >
        Nextra
      </TextAnimate>
      template
    </Title>

    <Text c="dimmed" maw={580} mt="sm" mx="auto" size="xl" ta="center">
      This starter Next.js project includes a minimal setup for server side rendering, if you want
      to learn more on Mantine + Next.js integration follow{' '}
      <Anchor href="https://mantine.dev/guides/next/">this guide</Anchor>. To get started edit{' '}
      <code className="jtx-inline-code jtx-inline-code-lg">page.tsx</code> file.
    </Text>

    <Center>
      <Button
        component="a"
        href="https://github.com/gfazioli/next-app-nextra-template"
        leftSection={<IconBrandGithub />}
        mt="xl"
        mx="auto"
        px={32}
        radius={256}
        rightSection={<IconExternalLink />}
        size="lg"
        variant="outline"
      >
        Use template v{pack.version}
      </Button>
    </Center>

    <Paper bg="black" mih={300} mx="auto" my={32} p={8} radius={8} shadow="xl">
      <TextAnimate.Typewriter
        multiline
        c="green.5"
        delay={100}
        ff="monospace"
        fz={11}
        loop={false}
        value={[
          'Dependencies :',
          ...Object.keys(pack.dependencies).map(
            (key: string) =>
              `${key} : ${pack.dependencies[key as keyof typeof pack.dependencies].toString()}`
          )
        ]}
      />
    </Paper>
  </Fragment>
);
